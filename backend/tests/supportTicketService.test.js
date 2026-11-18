import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createSupportTicketService} from '../src/services/supportTicketService.js'
import {supportRequestHash} from '../src/utils/supportTicketValidation.js'
const draft = () => ({request_id:randomUUID(),category:'bug',subject:'Calendar issue',description:'The calendar does not show my appointment.',language:'en'})
function fixture(overrides = {}) {
  const calls=[], db={query:async sql=>{calls.push(sql)},release:()=>calls.push('release')}
  const repo={lockSupportUser:async(db,id,write)=>{calls.push(['user',id,write]);return {id,active:true}},
    findSupportReplay:async()=>null,lockSupportSalonAccess:async()=>true,supportQuotaAvailable:async()=>true,
    insertSupportTicket:async(db,id,d,h)=>{calls.push(['insert',id,d,h]);return {id:'8',subject:d.subject,status:'open'}},
    listSupportTickets:async()=>[],findSupportTicket:async()=>null,...overrides}
  let connections=0
  const service=createSupportTicketService({dbPool:{connect:async()=>{connections++;return db}},repo})
  return {service,calls,connections:()=>connections,db}
}
test('support service creates an account ticket without salon using authenticated author',async()=>{
  const f=fixture(), body=draft(), r=await f.service.create(7,body)
  assert.equal(r.replayed,false);assert.equal(r.ticket.status,'open')
  assert.deepEqual(f.calls[1],['user','7',true]);assert.equal(f.calls[2][1],'7');assert.equal(f.calls[2][2].salon_id,null)
  assert.equal(f.calls[2][3],supportRequestHash(body));assert.deepEqual(f.calls.slice(-2),['COMMIT','release'])
})
test('support service rejects malformed payload before connecting',async()=>{
  const f=fixture();await assert.rejects(f.service.create(7,{...draft(),user_id:9}),{code:'SUPPORT_VALIDATION_ERROR'});assert.equal(f.connections(),0)
})
test('support service rejects missing or inactive database user on every operation',async()=>{
  for(const user of [null,{active:false}]) for(const op of ['create','list','detail']){
    const f=fixture({lockSupportUser:async()=>user})
    await assert.rejects(f.service[op](7,op==='create'?draft():op==='detail'?'8':{}),{code:'SUPPORT_FORBIDDEN'})
    assert.deepEqual(f.calls.slice(-2),['ROLLBACK','release'])
  }
})
test('support service checks membership for new salon ticket',async()=>{
  let checked
  const f=fixture({lockSupportSalonAccess:async(db,uid,sid)=>{checked=[uid,sid];return false}})
  await assert.rejects(f.service.create(7,{...draft(),salon_id:12}),{code:'SUPPORT_SALON_FORBIDDEN'})
  assert.deepEqual(checked,['7','12']);assert.equal(f.calls.some(x=>x[0]==='insert'),false)
})
test('support service checks persistent quota before insert',async()=>{
  const f=fixture({supportQuotaAvailable:async()=>false})
  await assert.rejects(f.service.create(7,draft()),{code:'SUPPORT_RATE_LIMITED'})
  assert.equal(f.calls.some(x=>x[0]==='insert'),false)
})
test('support service same key and content replays without quota or membership lookup',async()=>{
  const body={...draft(),salon_id:'12'}
  const f=fixture({findSupportReplay:async()=>({id:'8',request_hash:supportRequestHash(body)}),supportQuotaAvailable:async()=>{throw Error('must not check quota')},lockSupportSalonAccess:async()=>{throw Error('must not check old membership')}})
  const r=await f.service.create(7,body);assert.deepEqual(r,{ticket:{id:'8'},replayed:true})
})
test('support service same key different content fails without insert',async()=>{
  const f=fixture({findSupportReplay:async()=>({id:'8',request_hash:'different'})})
  await assert.rejects(f.service.create(7,draft()),{code:'SUPPORT_REQUEST_CONFLICT'})
  assert.equal(f.calls.some(x=>x[0]==='insert'),false)
})
test('support service list fetches 21 returns 20 and cursor from last returned ticket',async()=>{
  let args
  const f=fixture({listSupportTickets:async(db,...a)=>{args=a;return Array.from({length:21},(_,i)=>({id:String(50-i)}))}})
  const r=await f.service.list(7,{before:'51'})
  assert.deepEqual(args,['7','51',21]);assert.equal(r.tickets.length,20);assert.equal(r.next_before,'31')
})
test('support service empty or last page has null cursor',async()=>{
  for(const rows of [[],[{id:'8'}]]){const f=fixture({listSupportTickets:async()=>rows});assert.equal((await f.service.list(7)).next_before,null)}
})
test('support service foreign and missing detail are indistinguishable',async()=>{
  let args;const f=fixture({findSupportTicket:async(db,...a)=>{args=a;return null}})
  await assert.rejects(f.service.detail(7,'8'),{code:'SUPPORT_NOT_FOUND'});assert.deepEqual(args,['7','8'])
})
test('support service returns own detail and does not require salon context',async()=>{
  const f=fixture({findSupportTicket:async()=>({id:'8',salon_id:null})})
  assert.deepEqual(await f.service.detail(7,'8'),{id:'8',salon_id:null});assert.deepEqual(f.calls[1],['user','7',false])
})
test('support service rejects invalid cursors and IDs before connection',async()=>{
  const f=fixture()
  await assert.rejects(f.service.list(7,{user_id:'9'}),{code:'SUPPORT_VALIDATION_ERROR'})
  await assert.rejects(f.service.detail(7,'-1'),{code:'SUPPORT_VALIDATION_ERROR'});assert.equal(f.connections(),0)
})
test('support service rollback and release preserve original insert error',async()=>{
  const original=Error('database down'), f=fixture({insertSupportTicket:async()=>{throw original}})
  f.db.query=async sql=>{f.calls.push(sql);if(sql==='ROLLBACK')throw Error('rollback failed')}
  await assert.rejects(f.service.create(7,draft()),e=>e===original)
  assert.deepEqual(f.calls.slice(-2),['ROLLBACK','release'])
})
