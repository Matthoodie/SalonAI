import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createSupportOperationsService} from '../src/services/supportOperationsService.js'
import {supportOperation,operationHash} from '../src/utils/supportOperations.js'
const draft=()=>({request_id:randomUUID(),expected_revision:1,kind:'reply',body:'Test reply'})
function fixture(overrides={}){
 const calls=[],db={query:async sql=>calls.push(sql),release:()=>calls.push('release')}
 const ticket={id:'8',status:'open',revision:1}
 const repo={lockOperatorActor:async()=>calls.push('actor lock'),findTicket:async(_,tid,author,write)=>{calls.push(['ticket',tid,author,write]);return ticket},
 listTickets:async()=>[],listMessages:async()=>[],findReplay:async()=>null,replyQuota:async()=>true,
 insertMessage:async()=>{calls.push('message');return '4'},updateTicket:async(_,tid,status)=>{calls.push('update');return {revision:2,status}},
 insertOperation:async()=>calls.push('receipt'),audit:async()=>calls.push('audit'),...overrides.repo}
 const service=createSupportOperationsService({dbPool:{connect:async()=>{calls.push('connect');return db}},repo,
 notifyReply:overrides.notifyReply??(async()=>calls.push('notification')),
 authorize:overrides.authorize??(async()=>{calls.push('authorize');return {userId:'1',revision:3}}),
 lockAuthor:overrides.lockAuthor??(async()=>({active:true}))})
 return {service,calls,ticket}
}
test('operations service: reply and audit committed in same authorized transaction',async()=>{
 const {service,calls}=fixture();const result=await service.apply(1,8,draft());assert.equal(result.revision,2)
 assert.deepEqual(calls,['connect','BEGIN','actor lock','authorize',['ticket','8',null,true],'message','update','receipt','notification','audit','COMMIT','release'])
})
test('operations service: no operator grant prevents ticket reads and writes',async()=>{
 const {service,calls}=fixture({authorize:async()=>{throw Object.assign(Error(),{code:'SUPPORT_OPERATOR_FORBIDDEN'})}})
 await assert.rejects(service.apply(1,8,draft()),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 assert.ok(!calls.includes('message'));assert.ok(!calls.some(x=>Array.isArray(x)));assert.ok(calls.includes('ROLLBACK'))
})
test('operations service: author conversation is explicitly author scoped',async()=>{
 const {service,calls}=fixture();await service.messages(7,8)
 assert.ok(calls.some(x=>Array.isArray(x)&&x[2]==='7'));assert.ok(!calls.includes('authorize'));assert.ok(!calls.includes('audit'))
})
test('operations service: foreign and missing author conversation are same 404',async()=>{
 const {service}=fixture({repo:{findTicket:async()=>null}})
 await assert.rejects(service.messages(1,8),{code:'SUPPORT_NOT_FOUND'})
})
test('operations service: inactive author rejected before ticket read',async()=>{
 const {service,calls}=fixture({lockAuthor:async()=>({active:false})})
 await assert.rejects(service.messages(1,8),{code:'SUPPORT_FORBIDDEN'});assert.ok(!calls.some(x=>Array.isArray(x)))
})
test('operations service: stale revision cannot insert message',async()=>{
 const {service,calls}=fixture();await assert.rejects(service.apply(1,8,{...draft(),expected_revision:2}),{code:'SUPPORT_REVISION_CONFLICT'})
 assert.ok(!calls.includes('message'))
})
test('operations service: idempotent replay returns original result before stale revision',async()=>{
 const body=draft(),hash=operationHash(8,supportOperation(body))
 const {service,calls,ticket}=fixture({repo:{findReplay:async()=>({ticket_id:'8',request_hash:hash,result_revision:2,result_status:'pending',message_id:'4'})}})
 ticket.revision=9
 assert.deepEqual(await service.apply(1,8,body),{ticket_id:'8',revision:2,status:'pending',message_id:'4',replayed:true})
 assert.ok(!calls.includes('message'));assert.ok(!calls.includes('audit'));assert.ok(!calls.includes('notification'))
})
test('operations service: altered replay is conflict',async()=>{
 const {service}=fixture({repo:{findReplay:async()=>({ticket_id:'9',request_hash:'bad'})}})
 await assert.rejects(service.apply(1,8,draft()),{code:'SUPPORT_REQUEST_CONFLICT'})
})
test('operations service: audit failure rolls back entire reply',async()=>{
 const {service,calls}=fixture({repo:{audit:async()=>{throw Error('audit unavailable')}}})
 await assert.rejects(service.apply(1,8,draft()),/audit unavailable/);assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'))
})
test('operations service: status-only change creates no message',async()=>{
 const {service,calls}=fixture();await service.apply(1,8,{request_id:randomUUID(),expected_revision:1,kind:'status',status:'resolved'})
 assert.ok(!calls.includes('message'));assert.ok(calls.includes('audit'));assert.ok(!calls.includes('notification'))
})
test('operations service: same status is explicit no-op conflict',async()=>{
 const {service,calls}=fixture();await assert.rejects(service.apply(1,8,{request_id:randomUUID(),expected_revision:1,kind:'status',status:'open'}),{code:'SUPPORT_STATUS_UNCHANGED'})
 assert.ok(!calls.includes('update'))
})
test('operations service: reply quota denies before writes',async()=>{
 const {service,calls}=fixture({repo:{replyQuota:async()=>false}})
 await assert.rejects(service.apply(1,8,draft()),{code:'SUPPORT_RATE_LIMITED'});assert.ok(!calls.includes('message'))
})
test('operations service: bad input never opens connection',async()=>{
 const {service,calls}=fixture();assert.throws(()=>service.apply(1,8,{}));assert.equal(calls.length,0)
})
test('operations service: operator reads are audited; audit failure denies response',async()=>{
 const {service,calls}=fixture();await service.detail(1,8);assert.ok(calls.includes('audit'))
 const bad=fixture({repo:{audit:async()=>{throw Error('audit unavailable')}}});await assert.rejects(bad.service.list(1),/audit unavailable/)
})
test('operations service: bounded pages expose next cursor only when needed',async()=>{
 const rows=Array.from({length:21},(_,i)=>({id:String(50-i)}))
 const {service}=fixture({repo:{listTickets:async()=>rows,listMessages:async()=>Array.from({length:51},(_,i)=>({id:String(i+1)}))}})
 const result=await service.list(1);assert.equal(result.tickets.length,20);assert.equal(result.next_before,'31')
 const messages=await service.messages(1,8);assert.equal(messages.messages.length,50);assert.equal(messages.next_after,'50')
})

test('operations service: notification failure rolls back reply and receipt',async()=>{
 const {service,calls}=fixture({notifyReply:async()=>{throw Error('notification unavailable')}})
 await assert.rejects(service.apply(1,8,draft()),/notification unavailable/)
 assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));assert.ok(!calls.includes('audit'))
})
test('operations service: notification uses same database connection and persisted message',async()=>{
 let seen
 const {service,calls}=fixture({notifyReply:async(db,tid,mid)=>{seen={db,tid,mid};await db.query('notification write')}})
 await service.apply(1,8,draft());assert.equal(seen.tid,'8');assert.equal(seen.mid,'4')
 assert.ok(calls.indexOf('notification write')>calls.indexOf('receipt'));assert.ok(calls.indexOf('notification write')<calls.indexOf('COMMIT'))
})
