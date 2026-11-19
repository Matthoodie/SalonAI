import test from 'node:test'
import assert from 'node:assert/strict'
import {supportPayload,supportPage,createSupportApi} from '../src/api/supportApi.js'
import {newSupportRequest,saveSupportPending,readSupportPending,clearSupportPending} from '../src/components/Support/supportPending.js'
import {supportMessages,supportText,supportErrorText} from '../src/components/Support/supportMessages.js'
const uuid='12345678-abcd-4123-8123-123456789abc'
const draft=()=>({request_id:uuid,category:'bug',subject:'Test problem',description:'Ovo je testni opis problema.',language:'hr',salon_id:null,context:{page:'settings',app_version:null}})
const row=(id='8')=>({id,salon_id:null,category:'bug',subject:'Test problem',description:'Ovo je testni opis problema.',language:'hr',status:'open',context:{page:'settings'},created_at:'2026-11-19T10:00:00Z',updated_at:'2026-11-19T10:00:00Z'})
const response=(data,ok=true,status=200)=>({ok,status,json:async()=>data})
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m}}
const rejectsCode=(fn,code)=>assert.rejects(fn,e=>e.code===code)
test('payload normalizes whitespace, multiline CRLF and canonical IDs',()=>{
 const p=supportPayload({...draft(),subject:'  Test problem  ',description:'  First line of report\r\nSecond line  ',salon_id:7})
 assert.equal(p.subject,'Test problem');assert.equal(p.description,'First line of report\nSecond line');assert.equal(p.salon_id,'7')
})
test('payload counts Unicode code points and rejects malformed text',()=>{
 assert.equal([...supportPayload({...draft(),subject:'🐕'.repeat(160)}).subject].length,160)
 for(const subject of ['tiny','x'.repeat(161),'hello\nworld','hello\u0000world','hello\ud800'])assert.throws(()=>supportPayload({...draft(),subject}),e=>e.field==='subject')
})
test('payload rejects unsafe metadata and unknown attributes',()=>{
 for(const patch of [{user_id:9},{salon_id:'01'},{language:'de'},{request_id:'bad'},{category:'urgent'},{context:{page:'https://secret'}},{context:{page:'other',email:'private'}},{context:{page:'other',app_version:'a/b'}}])assert.throws(()=>supportPayload({...draft(),...patch}),e=>e.code==='SUPPORT_VALIDATION_ERROR')
})
test('description lower/upper bounds and line breaks',()=>{
 for(const description of ['short','a'.repeat(5001)])assert.throws(()=>supportPayload({...draft(),description}))
 assert.equal(supportPayload({...draft(),description:'a'.repeat(5000)}).description.length,5000)
})
test('page mapping never forwards arbitrary URLs or query strings',()=>{
 assert.equal(supportPage('/calendar'),'calendar');assert.equal(supportPage('/calendar?token=secret'),'other');assert.equal(supportPage('/unknown/private'),'other')
})
test('create uses private same-origin endpoint without salon header',async()=>{
 let call;const api=createSupportApi(async(...args)=>{call=args;return response({data:row(),replayed:false},true,201)})
 assert.equal((await api.create(draft())).ticket.id,'8');assert.equal(call[0],'/api/support/tickets');assert.equal(call[1].cache,'no-store');assert.equal(call[1].credentials,'same-origin');assert.equal(call[1].redirect,'error');assert.deepEqual(call[1].headers,{'Content-Type':'application/json'});assert.deepEqual(JSON.parse(call[1].body),draft())
})
test('replay preserves exact request identifier',async()=>{
 const bodies=[];const api=createSupportApi(async(_,o)=>{bodies.push(o.body);return response({data:row(),replayed:true})})
 assert.equal((await api.create(draft())).replayed,true);await api.create(draft());assert.equal(bodies[0],bodies[1])
})
test('create fails closed for mismatching confirmation',async()=>{
 for(const data of [{...row(),subject:'Different subject'},{...row(),salon_id:5},{...row(),description:'Different description entirely.'}])await rejectsCode(()=>createSupportApi(async()=>response({data,replayed:false})).create(draft()),'SUPPORT_INVALID_RESPONSE')
})
test('create requires replay flag and valid detail',async()=>{
 for(const body of [{data:row()},{data:{...row(),id:0},replayed:false},{data:{...row(),context:{}},replayed:false}])await rejectsCode(()=>createSupportApi(async()=>response(body)).create(draft()),'SUPPORT_INVALID_RESPONSE')
})
test('API errors discard arbitrary server messages',async()=>{
 const api=createSupportApi(async()=>response({error:{code:'SUPPORT_RATE_LIMITED',message:'private SQL secret'}},false,429))
 await assert.rejects(()=>api.create(draft()),e=>e.code==='SUPPORT_RATE_LIMITED'&&e.statusCode===429&&!e.message.includes('secret'))
})
test('aborted response cannot update caller after JSON resolves',async()=>{
 const controller=new AbortController();const api=createSupportApi(async()=>({ok:true,json:async()=>{controller.abort();return {data:row(),replayed:false}}}))
 await assert.rejects(()=>api.create(draft(),controller.signal),e=>e.name==='AbortError')
})
test('invalid JSON yields safe error',async()=>{
 const api=createSupportApi(async()=>({ok:true,json:async()=>{throw Error('raw body')}}))
 await rejectsCode(()=>api.list(),'SUPPORT_INVALID_RESPONSE')
})
test('list validates descending IDs and strips private/unexpected fields',async()=>{
 const api=createSupportApi(async()=>response({data:{tickets:[{...row('8'),user_id:'99',request_hash:'secret'},row('7')],next_before:null}}))
 const result=await api.list();assert.equal(result.tickets.length,2);assert.equal(result.tickets[0].user_id,undefined);assert.equal(result.tickets[0].description,undefined)
})
test('list rejects unordered, duplicate or cursor-crossing results',async()=>{
 for(const ids of [['7','8'],['8','8'],['10']])await rejectsCode(()=>createSupportApi(async()=>response({data:{tickets:ids.map(row),next_before:null}})).list('10'),'SUPPORT_INVALID_RESPONSE')
})
test('pagination only accepts last ID of complete page',async()=>{
 let url;const tickets=Array.from({length:20},(_,i)=>row(String(30-i)))
 const api=createSupportApi(async u=>{url=u;return response({data:{tickets,next_before:'11'}})})
 assert.equal((await api.list('31')).next_before,'11');assert.equal(url,'/api/support/tickets?before=31')
 await rejectsCode(()=>createSupportApi(async()=>response({data:{tickets:[row()],next_before:'8'}})).list(),'SUPPORT_INVALID_RESPONSE')
})
test('detail path rejects injection and mismatched returned ID',async()=>{
 let calls=0;const api=createSupportApi(async()=>{calls++;return response({data:row('9')})})
 await rejectsCode(()=>api.detail('../9'),'SUPPORT_VALIDATION_ERROR');assert.equal(calls,0)
 await rejectsCode(()=>api.detail('8'),'SUPPORT_INVALID_RESPONSE')
})
test('pending attempt survives reconstruction and remains account-scoped',()=>{
 const storage=memory();saveSupportPending(storage,1,draft());assert.deepEqual(readSupportPending(storage,1),draft());assert.equal(readSupportPending(storage,2),null)
 clearSupportPending(storage,2);assert.deepEqual(readSupportPending(storage,1),draft());clearSupportPending(storage,1);assert.equal(readSupportPending(storage,1),null)
})
test('corrupt or cross-account pending record fails without deletion',()=>{
 const storage=memory(),key='zrihtan:support:pending:v1:1';storage.setItem(key,JSON.stringify({user_id:'2',payload:draft()}))
 assert.throws(()=>readSupportPending(storage,1),e=>e.code==='SUPPORT_STORAGE_ERROR');assert.ok(storage.getItem(key))
 storage.setItem(key,'bad JSON');assert.throws(()=>readSupportPending(storage,1));assert.equal(storage.getItem(key),'bad JSON')
})
test('unavailable or full storage raises safe typed failure',()=>{
 assert.throws(()=>readSupportPending(null,1),e=>e.code==='SUPPORT_STORAGE_ERROR')
 assert.throws(()=>saveSupportPending({setItem(){throw Error('quota')}},1,draft()),e=>e.code==='SUPPORT_STORAGE_ERROR')
 assert.throws(()=>clearSupportPending(null,1),e=>e.code==='SUPPORT_STORAGE_ERROR')
})
test('new request captures language, page and salon exactly once',()=>{
 const value=newSupportRequest(draft(),{language:'en',page:'welcome',salonId:null},()=>uuid)
 assert.equal(value.language,'en');assert.equal(value.context.page,'welcome');assert.equal(value.request_id,uuid);assert.equal(value.salon_id,null)
 assert.throws(()=>newSupportRequest(draft(),{language:'hr'},()=>{throw Error('unavailable')}),e=>e.code==='SUPPORT_BROWSER_ERROR')
})
test('HR/EN message coverage and errors never echo server contents',()=>{
 assert.deepEqual(Object.keys(supportMessages.hr).sort(),Object.keys(supportMessages.en).sort())
 for(const language of ['hr','en']){for(const key of Object.keys(supportMessages.hr))assert.ok(supportText(language,key));assert.ok(!supportErrorText(language,{code:'UNKNOWN',message:'secret',statusCode:500}).includes('secret'))}
})
