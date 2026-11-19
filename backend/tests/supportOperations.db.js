import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {createSupportTicketService} from '../src/services/supportTicketService.js'
import {createSupportAccessService} from '../src/services/supportAccessService.js'
import {createSupportOperationsService} from '../src/services/supportOperationsService.js'
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
  await run({operator,author,other,ticket,change,audit,counts})
 }finally{
  for(const user of users){await pool.query('DELETE FROM support_ticket_audit WHERE operator_user_id_snapshot=$1',[user.id]);await pool.query('DELETE FROM platform_support_access_audit WHERE target_user_id_snapshot=$1',[user.id])}
  // Remove tickets before users so message/receipt FKs clean up predictably.
  for(const user of users)await pool.query('DELETE FROM support_tickets WHERE user_id=$1',[user.id])
  for(const user of users)await pool.query('DELETE FROM users WHERE id=$1',[user.id])
 }
}
test('operations DB: account without platform grant cannot list or read others',()=>fixture(async f=>{
 await assert.rejects(operations.list(f.other.id),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 await assert.rejects(operations.detail(f.author.id,f.ticket.id),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 assert.equal((await f.audit()).length,0)
}))
test('operations DB: operator without salon membership can read with audit',()=>fixture(async f=>{
 assert.equal((await operations.access(f.operator.id)).allowed,true)
 assert.equal(String((await operations.detail(f.operator.id,f.ticket.id)).id),String(f.ticket.id))
 await operations.list(f.operator.id,{status:'open'})
 assert.deepEqual((await f.audit()).map(x=>x.action),['detail','list'])
}))
test('operations DB: reply status receipt and audit persist atomically',()=>fixture(async f=>{
 const result=await operations.apply(f.operator.id,f.ticket.id,reply({status:'pending'}))
 assert.equal(result.revision,2);assert.equal(result.status,'pending');assert.ok(result.message_id)
 assert.deepEqual(await f.counts(),{messages:1,operations:1,revision:2})
 const event=(await f.audit())[0];assert.equal(event.action,'reply');assert.equal(event.previous_status,'open');assert.equal(event.new_status,'pending');assert.equal(event.access_revision,1)
 const conversation=await operations.messages(f.author.id,f.ticket.id)
 assert.equal(conversation.messages[0].body,'Synthetic support answer.');assert.ok(!('operator_user_id' in conversation.messages[0]))
}))
test('operations DB: another author sees neither ticket nor messages',()=>fixture(async f=>{
 await operations.apply(f.operator.id,f.ticket.id,reply())
 await assert.rejects(operations.messages(f.other.id,f.ticket.id),{code:'SUPPORT_NOT_FOUND'})
 await assert.rejects(operations.messages(f.other.id,'9007199254740991'),{code:'SUPPORT_NOT_FOUND'})
}))
test('operations DB: repeated request stays idempotent after later revision',()=>fixture(async f=>{
 const body=reply(),first=await operations.apply(f.operator.id,f.ticket.id,body)
 await operations.apply(f.operator.id,f.ticket.id,{request_id:randomUUID(),expected_revision:2,kind:'status',status:'resolved'})
 const second=await operations.apply(f.operator.id,f.ticket.id,body)
 assert.equal(second.replayed,true);assert.equal(second.message_id,first.message_id);assert.equal(second.revision,2)
 assert.deepEqual(await f.counts(),{messages:1,operations:2,revision:3})
 await assert.rejects(operations.apply(f.operator.id,f.ticket.id,{...body,body:'Changed'}),{code:'SUPPORT_REQUEST_CONFLICT'})
}))
test('operations DB: two operators cannot overwrite same revision',()=>fixture(async f=>{
 await f.change(f.other)
 const results=await Promise.allSettled([operations.apply(f.operator.id,f.ticket.id,reply()),operations.apply(f.other.id,f.ticket.id,reply())])
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'SUPPORT_REVISION_CONFLICT')
 assert.deepEqual(await f.counts(),{messages:1,operations:1,revision:2})
}))
test('operations DB: simultaneous same request produces one reply',()=>fixture(async f=>{
 const body=reply(),results=await Promise.all([operations.apply(f.operator.id,f.ticket.id,body),operations.apply(f.operator.id,f.ticket.id,body)])
 assert.equal(results.filter(x=>x.replayed).length,1);assert.deepEqual(await f.counts(),{messages:1,operations:1,revision:2})
}))
test('operations DB: failed audit rolls back message status and receipt',()=>fixture(async f=>{
 const broken=createSupportOperationsService({repo:{...repository,audit:async()=>{throw Error('synthetic audit failure')}}})
 await assert.rejects(broken.apply(f.operator.id,f.ticket.id,reply({status:'resolved'})),/synthetic audit failure/)
 assert.deepEqual(await f.counts(),{messages:0,operations:0,revision:1})
 assert.equal((await pool.query('SELECT status FROM support_tickets WHERE id=$1',[f.ticket.id])).rows[0].status,'open')
}))
test('operations DB: revocation also blocks replay and later reads',()=>fixture(async f=>{
 const body=reply();await operations.apply(f.operator.id,f.ticket.id,body)
 await f.change(f.operator,{action:'revoke',expectedRevision:1})
 await assert.rejects(operations.apply(f.operator.id,f.ticket.id,body),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 await assert.rejects(operations.detail(f.operator.id,f.ticket.id),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
}))
test('operations DB: messages pagination is ascending bounded and private',()=>fixture(async f=>{
 await pool.query("INSERT INTO support_ticket_messages(ticket_id,operator_user_id,body) SELECT $1,$2,'Synthetic page '||n FROM generate_series(1,51) n",[f.ticket.id,f.operator.id])
 const first=await operations.messages(f.author.id,f.ticket.id),second=await operations.messages(f.author.id,f.ticket.id,{after:first.next_after})
 assert.equal(first.messages.length,50);assert.equal(second.messages.length,1);assert.equal(second.next_after,null)
 assert.ok(Number(second.messages[0].id)>Number(first.messages.at(-1).id))
}))
test('operations DB: reply quota checked before insertion',()=>fixture(async f=>{
 await pool.query("INSERT INTO support_ticket_messages(ticket_id,operator_user_id,body) SELECT $1,$2,'Synthetic quota '||n FROM generate_series(1,120) n",[f.ticket.id,f.operator.id])
 await assert.rejects(operations.apply(f.operator.id,f.ticket.id,reply()),{code:'SUPPORT_RATE_LIMITED'})
 assert.deepEqual(await f.counts(),{messages:120,operations:0,revision:1})
}))
test('operations DB: author deletion removes conversation but preserves minimal audit',()=>fixture(async f=>{
 await operations.apply(f.operator.id,f.ticket.id,reply())
 await pool.query('DELETE FROM users WHERE id=$1',[f.author.id])
 assert.equal((await pool.query('SELECT id FROM support_ticket_messages WHERE ticket_id=$1',[f.ticket.id])).rows.length,0)
 const event=(await f.audit())[0];assert.equal(event.ticket_id,null);assert.equal(String(event.ticket_id_snapshot),String(f.ticket.id))
}))
