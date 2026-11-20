import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {createSupportTicketService} from '../src/services/supportTicketService.js'
import {createSupportAccessService} from '../src/services/supportAccessService.js'
import {createSupportOperationsService} from '../src/services/supportOperationsService.js'
import {recordReplyNotification} from '../src/repositories/supportNotificationRepository.js'
import {previewSupportNotifications} from '../src/services/supportNotificationPreviewService.js'
import * as repository from '../src/repositories/supportOperationsRepository.js'
after(()=>pool.end())
const operations=createSupportOperationsService(),tickets=createSupportTicketService(),access=createSupportAccessService({dbPool:pool})
const reply=(patch={})=>({request_id:randomUUID(),expected_revision:1,kind:'reply',body:'Synthetic support answer.',...patch})
async function fixture(run){
 const database=(await pool.query('SELECT current_database() AS name')).rows[0].name
 assert.ok(database==='salonai_regression'||/(^|[_-])test([_-]|$)/i.test(database),'TEST database required')
 const users=[]
 try{
  for(let i=0;i<3;i++)users.push((await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id,auth_subject",['user_Ops'+randomUUID().replaceAll('-',''),randomUUID()+'@example.test'])).rows[0])
  const [operator,author,other]=users
  const change=(user,patch={})=>access.change({subject:user.auth_subject,action:'grant',expectedRevision:0,reason:'Synthetic operations test grant',...patch},{database,apply:true})
  await change(operator)
  const ticket=(await tickets.create(author.id,{request_id:randomUUID(),category:'help',subject:'Synthetic support ticket',description:'Please explain the synthetic test workflow.',language:'en'})).ticket
  const audit=async()=> (await pool.query('SELECT * FROM support_ticket_audit WHERE operator_user_id_snapshot=$1 ORDER BY id',[operator.id])).rows
  const counts=async()=> (await pool.query(`SELECT (SELECT count(*)::int FROM support_ticket_messages WHERE ticket_id=$1) AS messages,
    (SELECT count(*)::int FROM support_ticket_operations WHERE ticket_id=$1) AS operations,
    (SELECT revision FROM support_tickets WHERE id=$1) AS revision`,[ticket.id])).rows[0]
  await run({operator,author,other,ticket,change,audit,counts,database})
 }finally{
  for(const user of users){await pool.query('DELETE FROM support_ticket_audit WHERE operator_user_id_snapshot=$1',[user.id]);await pool.query('DELETE FROM platform_support_access_audit WHERE target_user_id_snapshot=$1',[user.id])}
  // Remove tickets before users so message/receipt FKs clean up predictably.
  for(const user of users)await pool.query('DELETE FROM support_tickets WHERE user_id=$1',[user.id])
  for(const user of users)await pool.query('DELETE FROM users WHERE id=$1',[user.id])
 }
}
const events=async tid=>(await pool.query(`SELECT o.* FROM support_notification_outbox o JOIN support_ticket_messages m ON m.id=o.message_id WHERE m.ticket_id=$1 ORDER BY o.id`,[tid])).rows

test('notification DB: reply commits exactly one held event in ticket language',()=>fixture(async f=>{
 const r=await operations.apply(f.operator.id,f.ticket.id,reply()),rows=await events(f.ticket.id)
 assert.equal(rows.length,1);assert.equal(String(rows[0].message_id),String(r.message_id))
 assert.equal(rows[0].state,'held');assert.equal(rows[0].event_type,'support_reply');assert.equal(rows[0].language,'en')
 assert.deepEqual(await f.counts(),{messages:1,operations:1,revision:2})
}))
test('notification DB: repeated and concurrent request creates one event',()=>fixture(async f=>{
 const body=reply();await Promise.all([operations.apply(f.operator.id,f.ticket.id,body),operations.apply(f.operator.id,f.ticket.id,body)])
 await operations.apply(f.operator.id,f.ticket.id,body);assert.equal((await events(f.ticket.id)).length,1)
}))
test('notification DB: status-only update creates no event',()=>fixture(async f=>{
 await operations.apply(f.operator.id,f.ticket.id,{request_id:randomUUID(),kind:'status',expected_revision:1,status:'resolved'})
 assert.equal((await events(f.ticket.id)).length,0)
}))
test('notification DB: later distinct reply has a distinct event',()=>fixture(async f=>{
 await operations.apply(f.operator.id,f.ticket.id,reply())
 await operations.apply(f.operator.id,f.ticket.id,reply({expected_revision:2}))
 const rows=await events(f.ticket.id);assert.equal(rows.length,2);assert.notEqual(rows[0].message_id,rows[1].message_id)
}))
test('notification DB: failed outbox insert rolls back reply receipt revision and audit',()=>fixture(async f=>{
 const broken=createSupportOperationsService({notifyReply:async(db,tid,mid)=>{
   await recordReplyNotification(db,tid,mid)
   // Real database constraint failure in the same transaction.
   await recordReplyNotification(db,tid,mid)
 }})
 await assert.rejects(broken.apply(f.operator.id,f.ticket.id,reply()),{code:'23505'})
 assert.deepEqual(await f.counts(),{messages:0,operations:0,revision:1});assert.equal((await events(f.ticket.id)).length,0);assert.equal((await f.audit()).length,0)
}))
test('notification DB: failed audit also rolls back new event',()=>fixture(async f=>{
 const broken=createSupportOperationsService({repo:{...repository,audit:async()=>{throw Error('synthetic failure')}}})
 await assert.rejects(broken.apply(f.operator.id,f.ticket.id,reply()),/synthetic failure/)
 assert.equal((await events(f.ticket.id)).length,0);assert.deepEqual(await f.counts(),{messages:0,operations:0,revision:1})
}))
test('notification DB: no grant means no event',()=>fixture(async f=>{
 await assert.rejects(operations.apply(f.other.id,f.ticket.id,reply()),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 assert.equal((await events(f.ticket.id)).length,0)
}))
test('notification DB: preview is bounded private and leaves events unchanged',()=>fixture(async f=>{
 await operations.apply(f.operator.id,f.ticket.id,reply())
 const before=await events(f.ticket.id),view=await previewSupportNotifications(pool,{database:f.database})
 assert.equal(view.delivery_enabled,false);assert.ok(view.events.length<=20)
 assert.ok(view.events.some(x=>String(x.ticket_id)===String(f.ticket.id)))
 assert.ok(!JSON.stringify(view).includes('Synthetic support answer.'))
 assert.deepEqual(await events(f.ticket.id),before)
 await assert.rejects(previewSupportNotifications(pool,{database:'wrong_database'}),/mismatch/)
}))
test('notification DB: author deletion removes pending events through ticket/message cascade',()=>fixture(async f=>{
 await operations.apply(f.operator.id,f.ticket.id,reply());const id=(await events(f.ticket.id))[0].id
 await pool.query('DELETE FROM users WHERE id=$1',[f.author.id])
 assert.equal((await pool.query('SELECT id FROM support_notification_outbox WHERE id=$1',[id])).rowCount,0)
}))
test('notification DB: language snapshot persists and no event backfill for direct historical messages',()=>fixture(async f=>{
 await pool.query("UPDATE support_tickets SET language='hr' WHERE id=$1",[f.ticket.id])
 await operations.apply(f.operator.id,f.ticket.id,reply())
 await pool.query("UPDATE support_tickets SET language='en' WHERE id=$1",[f.ticket.id])
 await pool.query("INSERT INTO support_ticket_messages(ticket_id,operator_user_id,body) VALUES($1,$2,'Synthetic old message')",[f.ticket.id,f.operator.id])
 const rows=await events(f.ticket.id);assert.equal(rows.length,1);assert.equal(rows[0].language,'hr')
}))
