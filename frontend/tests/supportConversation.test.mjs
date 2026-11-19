import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createSupportConversationApi,operatorPayload} from '../src/api/supportConversationApi.js'
import {readOperatorPending,saveOperatorPending,clearOperatorPending,newOperatorPayload} from '../src/components/Support/operatorPending.js'
import {conversationMessages} from '../src/components/Support/conversationMessages.js'
const row=(patch={})=>({id:'8',salon_id:null,category:'help',subject:'Test request',description:'This description is long enough.',language:'en',context:{page:'welcome'},status:'open',revision:1,created_at:'2026-11-19T10:00:00Z',updated_at:'2026-11-19T10:00:00Z',...patch})
const draft=(patch={})=>({request_id:randomUUID(),expected_revision:1,kind:'reply',body:'Reply text',status:'pending',...patch})
const ok=data=>({ok:true,status:200,json:async()=>({data})})
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map}}
test('conversation: reply normalization matches backend',()=>{assert.equal(operatorPayload(draft({body:'  Hello\r\n😀  '})).body,'Hello\n😀')})
test('conversation: strict revision UUID and operation kind',()=>{
 for(const expected_revision of [0,-1,'1',1.1,2147483647])assert.throws(()=>operatorPayload(draft({expected_revision})))
 assert.throws(()=>operatorPayload(draft({request_id:'not-uuid'})));assert.throws(()=>operatorPayload(draft({kind:'delete'})))
})
test('conversation: identity injection and invalid status refused',()=>{
 for(const key of ['operator_user_id','user_id','revision','salon_id'])assert.throws(()=>operatorPayload({...draft(),[key]:1}))
 assert.throws(()=>operatorPayload(draft({status:'done'})))
})
test('conversation: Unicode boundaries and controls',()=>{
 assert.equal([...operatorPayload(draft({body:'😀'.repeat(5000)})).body].length,5000)
 for(const body of ['','   ','\u0000','\ud800','a'.repeat(5001)])assert.throws(()=>operatorPayload(draft({body})))
})
test('conversation: status only requires state and forbids body',()=>{
 assert.deepEqual(operatorPayload(draft({kind:'status',body:undefined})).kind,'status')
 assert.throws(()=>operatorPayload(draft({kind:'status'})))
 assert.throws(()=>operatorPayload(draft({kind:'status',body:undefined,status:undefined})))
})
test('conversation: API requests are private and credentialled',async()=>{
 let request;const api=createSupportConversationApi(async(path,options)=>{request={path,options};return ok({allowed:true})})
 assert.equal(await api.access(),true);assert.equal(request.path,'/api/support/operations/access')
 assert.equal(request.options.cache,'no-store');assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.redirect,'error')
})
test('conversation: author and operator use distinct endpoints',async()=>{
 const paths=[];const api=createSupportConversationApi(async(path)=>{paths.push(path);return ok({ticket:row(),messages:[],next_after:null})})
 await api.messages(8);await api.messages(8,{operator:true})
 assert.deepEqual(paths,['/api/support/tickets/8/messages','/api/support/operations/tickets/8/messages'])
})
test('conversation: message fields are projected without operator identity',async()=>{
 const api=createSupportConversationApi(async()=>ok({ticket:row(),messages:[{id:'1',body:'<script>test</script>',created_at:row().created_at,operator_user_id:'7'}],next_after:null}))
 const data=await api.messages(8);assert.equal(data.messages[0].body,'<script>test</script>');assert.ok(!('operator_user_id' in data.messages[0]))
})
test('conversation: mismatched ticket and malformed message fail closed',async()=>{
 for(const data of [{ticket:row({id:9}),messages:[],next_after:null},{ticket:row(),messages:[{id:1,body:'x',created_at:'bad'}],next_after:null},{ticket:row({revision:0}),messages:[],next_after:null}])await assert.rejects(createSupportConversationApi(async()=>ok(data)).messages(8),{code:'SUPPORT_INVALID_RESPONSE'})
})
test('conversation: bounded ascending message cursors',async()=>{
 const messages=Array.from({length:50},(_,i)=>({id:String(i+1),body:'text',created_at:row().created_at}))
 const api=createSupportConversationApi(async()=>ok({ticket:row(),messages,next_after:'50'}))
 assert.equal((await api.messages(8)).next_after,'50')
 await assert.rejects(api.messages(8,{after:1}),{code:'SUPPORT_INVALID_RESPONSE'})
 await assert.rejects(createSupportConversationApi(async()=>ok({ticket:row(),messages:messages.slice(0,2),next_after:'2'})).messages(8))
})
test('conversation: list filter and descending cursor verified',async()=>{
 let path;const api=createSupportConversationApi(async p=>{path=p;return ok({tickets:[row({status:'pending'})],next_before:null})})
 await api.list({before:9,status:'pending'});assert.equal(path,'/api/support/operations/tickets?before=9&status=pending')
 await assert.rejects(api.list({status:'closed'}));await assert.rejects(api.list({before:8}))
})
test('conversation: invalid query never makes network request',async()=>{
 let calls=0;const api=createSupportConversationApi(async()=>{calls++;return ok({})})
 await assert.rejects(api.messages('01'));await assert.rejects(api.messages(8,{operator:'true'}));await assert.rejects(api.list({status:'all'}));assert.equal(calls,0)
})
test('conversation: reply result must match ticket revision status and message kind',async()=>{
 const body=draft();const result={ticket_id:'8',revision:2,status:'pending',message_id:'3',replayed:false}
 assert.equal((await createSupportConversationApi(async()=>ok(result)).apply(8,body)).message_id,'3')
 for(const patch of [{ticket_id:9},{revision:3},{status:'closed'},{message_id:null},{replayed:'yes'}])await assert.rejects(createSupportConversationApi(async()=>ok({...result,...patch})).apply(8,body),{code:'SUPPORT_INVALID_RESPONSE'})
})
test('conversation: status receipt has no message and replay remains original',async()=>{
 const api=createSupportConversationApi(async()=>ok({ticket_id:'8',revision:2,status:'resolved',message_id:null,replayed:true}))
 const result=await api.apply(8,draft({kind:'status',body:undefined,status:'resolved'}));assert.equal(result.replayed,true)
})
test('conversation: HTTP errors preserve code without exposing raw text',async()=>{
 const api=createSupportConversationApi(async()=>({ok:false,status:403,json:async()=>({error:{code:'SUPPORT_OPERATOR_FORBIDDEN',message:'secret'}})}))
 await assert.rejects(api.access(),e=>e.code==='SUPPORT_OPERATOR_FORBIDDEN'&&e.statusCode===403&&!e.message.includes('secret'))
})
test('conversation: malformed JSON and aborted result rejected',async()=>{
 await assert.rejects(createSupportConversationApi(async()=>({ok:true,json:async()=>{throw Error()}})).access(),{code:'SUPPORT_INVALID_RESPONSE'})
 const controller=new AbortController();controller.abort()
 await assert.rejects(createSupportConversationApi(async()=>ok({allowed:true})).access(controller.signal),{name:'AbortError'})
})
test('conversation: pending record is scoped by account and ticket',()=>{
 const s=storage(),body=draft();saveOperatorPending(s,7,8,body)
 assert.deepEqual(readOperatorPending(s,7,8),body);assert.equal(readOperatorPending(s,9,8),null);assert.equal(readOperatorPending(s,7,9),null)
})
test('conversation: pending payload preserves request ID and revision',()=>{
 const s=storage(),body=draft({expected_revision:12});saveOperatorPending(s,7,8,body)
 assert.equal(readOperatorPending(s,7,8).request_id,body.request_id);assert.equal(readOperatorPending(s,7,8).expected_revision,12)
})
test('conversation: corrupted oversized or mismatched saved records rejected',()=>{
 for(const raw of ['{','x'.repeat(40001),JSON.stringify({user_id:'9',ticket_id:'8',payload:draft()})]){
 const s=storage();s.setItem('zrihtan:support:operation:v1:7:8',raw);assert.throws(()=>readOperatorPending(s,7,8),{code:'SUPPORT_STORAGE_ERROR'})}
})
test('conversation: storage failure cannot create an untracked attempt',()=>{
 assert.throws(()=>saveOperatorPending({setItem(){throw Error()}},7,8,draft()),{code:'SUPPORT_STORAGE_ERROR'})
 assert.throws(()=>readOperatorPending(null,7,8),{code:'SUPPORT_STORAGE_ERROR'})
})
test('conversation: clear removes only selected attempt',()=>{
 const s=storage();saveOperatorPending(s,7,8,draft());saveOperatorPending(s,7,9,draft());clearOperatorPending(s,7,8)
 assert.equal(readOperatorPending(s,7,8),null);assert.ok(readOperatorPending(s,7,9))
})
test('conversation: new payload uses injected UUID and canonical data',()=>{
 const uuid=randomUUID(),data=newOperatorPayload({kind:'reply',body:' Text ',status:'open'},3,()=>uuid)
 assert.equal(data.request_id,uuid);assert.equal(data.body,'Text');assert.equal(data.expected_revision,3)
})
test('conversation: UUID generator failure is explicit',()=>{assert.throws(()=>newOperatorPayload({kind:'reply',body:'x',status:'open'},1,()=>{throw Error()}),{code:'SUPPORT_BROWSER_ERROR'})})
test('conversation: Croatian and English dictionaries have identical complete keys',()=>{
 assert.deepEqual(Object.keys(conversationMessages.hr).sort(),Object.keys(conversationMessages.en).sort())
 for(const lang of ['hr','en'])for(const value of Object.values(conversationMessages[lang]))assert.ok(typeof value==='string'&&value.trim().length>0)
})
