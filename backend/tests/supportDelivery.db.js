import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {createSupportTicketService} from '../src/services/supportTicketService.js'
import {recordReplyNotification} from '../src/repositories/supportNotificationRepository.js'
import * as repo from '../src/repositories/supportDeliveryRepository.js'
import {createSupportDeliveryService} from '../src/services/supportDeliveryService.js'
after(()=>pool.end())
const tickets=createSupportTicketService()
async function fixture(run){
 const name=(await pool.query('SELECT current_database() AS name')).rows[0].name
 assert.ok(name==='salonai_regression'||/(^|[_-])test([_-]|$)/i.test(name),'TEST database required')
 const user=(await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES('clerk',$1,$2) RETURNING *",['user_delivery'+randomUUID().replaceAll('-',''),randomUUID()+'@example.test'])).rows[0]
 try{
  const ticket=(await tickets.create(user.id,{request_id:randomUUID(),category:'help',subject:'Synthetic delivery ticket',description:'Synthetic isolated delivery database test.',language:'en'})).ticket
  const message=(await pool.query("INSERT INTO support_ticket_messages(ticket_id,operator_user_id,body) VALUES($1,$2,'Private reply not for email') RETURNING id",[ticket.id,user.id])).rows[0]
  const id=await recordReplyNotification(pool,ticket.id,message.id)
  const input={eventId:String(id),authorId:String(user.id),activationAfter:'2020-01-01T00:00:00.000Z',allowedRecipient:user.email}
  let sends=0;const payloads=[]
  const service=(send=async()=>({outcome:'accepted',providerId:'fake-provider-id'}))=>createSupportDeliveryService({enabled:true,dbPool:pool,
    resolveVerifiedContact:async subject=>({subject,email:user.email,verified:true}),
    send:async payload=>{sends++;payloads.push(payload);return send(payload)},
  })
  const state=async()=>(await pool.query('SELECT state FROM support_notification_outbox WHERE id=$1',[id])).rows[0]?.state
  const snapshot=async()=>(await pool.query('SELECT * FROM support_notification_delivery WHERE event_id=$1',[id])).rows[0]
  const attempts=async()=>(await pool.query('SELECT * FROM support_notification_attempts WHERE event_id=$1 ORDER BY attempt_number',[id])).rows
  const tx=async(fn)=>{const db=await pool.connect();try{await db.query('BEGIN');const r=await fn(db);await db.query('COMMIT');return r}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}}
  const claim=()=>tx(async db=>repo.claimDelivery(db,await repo.lockDeliveryEvent(db,id,user.id),user.email))
  await run({user,ticket,id,input,service,state,snapshot,attempts,tx,claim,payloads,get sends(){return sends}})
 }finally{await pool.query('DELETE FROM support_tickets WHERE user_id=$1',[user.id]);await pool.query('DELETE FROM users WHERE id=$1',[user.id])}
}
test('delivery DB: new events stay held with no delivery rows',()=>fixture(async f=>{
 assert.equal(await f.state(),'held');assert.equal(await f.snapshot(),undefined);assert.equal(f.sends,0)
}))
test('delivery DB: cutoff rejects historical event',()=>fixture(async f=>{
 assert.equal((await f.service().prepare({...f.input,activationAfter:'2099-01-01T00:00:00.000Z'})).reason,'before_activation')
 assert.equal(await f.state(),'held');assert.equal(await f.snapshot(),undefined)
}))
test('delivery DB: concurrent preparation freezes exactly one minimal payload',()=>fixture(async f=>{
 await Promise.all([f.service().prepare(f.input),f.service().prepare(f.input)])
 const before=await f.snapshot();assert.equal(await f.state(),'ready');assert.equal(before.recipient,f.user.email)
 assert.equal(before.text_body.includes('Private reply'),false)
 await f.service().prepare(f.input);assert.deepEqual(await f.snapshot(),before)
}))
test('delivery DB: author mismatch never prepares or sends',()=>fixture(async f=>{
 const wrong={...f.input,authorId:'9007199254740991'}
 assert.equal((await f.service().prepare(wrong)).state,'blocked');assert.equal(await f.state(),'held');assert.equal(f.sends,0)
}))
test('delivery DB: one concurrent claim sends once; accepted cannot resend',()=>fixture(async f=>{
 await f.service().prepare(f.input)
 await Promise.all([f.service().runOne(f.input),f.service().runOne(f.input)])
 assert.equal(f.sends,1);assert.equal(await f.state(),'accepted')
 await f.service().runOne(f.input);assert.equal(f.sends,1)
 assert.equal((await f.attempts()).length,1);assert.equal((await f.attempts())[0].outcome,'accepted')
}))
test('delivery DB: unknown outcome is terminal for automatic delivery',()=>fixture(async f=>{
 const s=f.service(async()=>{throw Error('synthetic network timeout')});await s.prepare(f.input);await s.runOne(f.input)
 assert.equal(await f.state(),'uncertain');await s.runOne(f.input);assert.equal(f.sends,1)
}))
test('delivery DB: rate limit waits and retries same key and frozen payload',()=>fixture(async f=>{
 const s=f.service(async()=>({outcome:'rate_limited'}));await s.prepare(f.input);await s.runOne(f.input)
 assert.equal(await f.state(),'ready');assert.equal((await s.runOne(f.input)).reason,'backoff');assert.equal(f.sends,1)
 await pool.query("UPDATE support_notification_delivery SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE event_id=$1",[f.id])
 await f.service().runOne(f.input);assert.equal(await f.state(),'accepted');assert.equal(f.sends,2)
 assert.deepEqual(f.payloads[0],f.payloads[1]);assert.equal((await f.attempts()).length,2)
}))
test('delivery DB: three rate limits suppress further attempts',()=>fixture(async f=>{
 const s=f.service(async()=>({outcome:'rate_limited'}));await s.prepare(f.input)
 for(let i=0;i<3;i++){
 await pool.query("UPDATE support_notification_delivery SET next_attempt_at=NULL WHERE event_id=$1",[f.id]);await s.runOne(f.input)
 }
 assert.equal(await f.state(),'suppressed');await s.runOne(f.input);assert.equal(f.sends,3)
}))
test('delivery DB: retry deadline expiry suppresses without another send',()=>fixture(async f=>{
 const s=f.service(async()=>({outcome:'rate_limited'}));await s.prepare(f.input);await s.runOne(f.input)
 await pool.query("UPDATE support_notification_delivery SET first_attempt_at=statement_timestamp()-interval '24 hours',retry_until=statement_timestamp()-interval '1 hour',next_attempt_at=NULL WHERE event_id=$1",[f.id])
 assert.equal((await s.runOne(f.input)).reason,'retry_exhausted');assert.equal(f.sends,1)
}))
test('delivery DB: expired lease becomes uncertain, never reclaimed',()=>fixture(async f=>{
 await f.service().prepare(f.input);const claim=await f.claim();assert.ok(claim.token)
 await pool.query("UPDATE support_notification_delivery SET lease_until=clock_timestamp()-interval '1 second' WHERE event_id=$1",[f.id])
 assert.equal((await f.service().runOne(f.input)).state,'uncertain');assert.equal(f.sends,0)
 assert.equal((await f.attempts())[0].outcome,'lease_expired')
 const result=await f.tx(db=>repo.finishDelivery(db,f.id,claim.token,{outcome:'accepted',providerId:'late'}))
 assert.equal(result.reason,'stale_attempt');assert.equal(await f.state(),'uncertain')
}))
test('delivery DB: stale token cannot finish another claim',()=>fixture(async f=>{
 await f.service().prepare(f.input);const claim=await f.claim()
 const r=await f.tx(db=>repo.finishDelivery(db,f.id,randomUUID(),{outcome:'accepted',providerId:'wrong'}))
 assert.equal(r.reason,'stale_attempt');assert.equal(await f.state(),'sending')
 await f.tx(db=>repo.finishDelivery(db,f.id,claim.token,{outcome:'accepted',providerId:'correct'}));assert.equal(await f.state(),'accepted')
}))
test('delivery DB: rejected response is persisted and not retried',()=>fixture(async f=>{
 const s=f.service(async()=>({outcome:'rejected'}));await s.prepare(f.input);await s.runOne(f.input);await s.runOne(f.input)
 assert.equal(await f.state(),'rejected');assert.equal(f.sends,1)
}))
test('delivery DB: deactivated author prevents sending prepared event',()=>fixture(async f=>{
 await f.service().prepare(f.input);await pool.query('UPDATE users SET active=false WHERE id=$1',[f.user.id])
 assert.equal((await f.service().runOne(f.input)).state,'blocked');assert.equal(f.sends,0)
}))
test('delivery DB: changed verified address cannot rewrite frozen recipient',()=>fixture(async f=>{
 await f.service().prepare(f.input)
 const s=createSupportDeliveryService({enabled:true,dbPool:pool,resolveVerifiedContact:async subject=>({subject,email:'changed@example.test',verified:true}),send:async()=>{throw Error('must not send')}})
 assert.equal((await s.runOne({...f.input,allowedRecipient:'changed@example.test'})).state,'suppressed')
 assert.equal((await f.snapshot()).recipient,f.user.email)
}))
test('delivery DB: transaction rollback leaves no partial claim',()=>fixture(async f=>{
 await f.service().prepare(f.input)
 await assert.rejects(f.tx(async db=>{await repo.claimDelivery(db,await repo.lockDeliveryEvent(db,f.id,f.user.id),f.user.email);throw Error('rollback')}))
 assert.equal(await f.state(),'ready');assert.equal((await f.snapshot()).attempt_count,0);assert.equal((await f.attempts()).length,0)
}))
test('delivery DB: deleting ticket cascades delivery snapshots and attempts',()=>fixture(async f=>{
 await f.service().prepare(f.input);await f.service().runOne(f.input)
 await pool.query('DELETE FROM support_tickets WHERE id=$1',[f.ticket.id])
 assert.equal(await f.snapshot(),undefined);assert.equal((await f.attempts()).length,0)
}))

test('delivery DB: frozen snapshot cannot be overwritten directly',()=>fixture(async f=>{
 await f.service().prepare(f.input)
 for(const column of ['recipient','subject','text_body'])await assert.rejects(pool.query(`UPDATE support_notification_delivery SET ${column}='changed' WHERE event_id=$1`,[f.id]),/immutable/)
 await assert.rejects(pool.query('UPDATE support_notification_delivery SET idempotency_key=$2 WHERE event_id=$1',[f.id,randomUUID()]),/immutable/)
 assert.equal((await f.snapshot()).recipient,f.user.email)
}))
