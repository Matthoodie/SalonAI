import test from 'node:test'
import assert from 'node:assert/strict'
import {createSupportResendTransport} from '../src/services/supportResendTransport.js'
const to = 'test@example.com'
const message = {to,subject:'ZRIHTAN test',text:'Synthetic notification.',idempotencyKey:'support-reply/dev/123'}
const options = {enabled:true,apiKey:'re_test_only',allowedRecipients:[to]}
const ok = async () => ({status:200,json:async()=>({id:'test-provider-id'})})

test('default off never calls provider',async()=>{
 let calls=0
 const send=createSupportResendTransport({fetchImpl:()=>{calls++}})
 assert.deepEqual(await send(message),{outcome:'disabled'});assert.equal(calls,0)
})
test('requires explicit boolean and valid enabled configuration',()=>{
 for(const cfg of [{enabled:'true'},{...options,apiKey:''},{...options,allowedRecipients:[]},{...options,allowedRecipients:[to,'second@example.com']},{...options,timeoutMs:0}]) assert.throws(()=>createSupportResendTransport(cfg),/configuration/)
})
test('blocks other recipients without redirecting them to the tester',async()=>{
 let calls=0
 const send=createSupportResendTransport({...options,fetchImpl:()=>{calls++}})
 for(const value of ['other@example.com',to+',second@example.com',to+'\nBcc: other@example.com']) assert.equal((await send({...message,to:value})).outcome,'blocked')
 assert.equal(calls,0)
})
test('copies allowlist to prevent mutation after construction',async()=>{
 const list=[to];const send=createSupportResendTransport({...options,allowedRecipients:list,fetchImpl:ok})
 list[0]='other@example.com'
 assert.equal((await send({...message,to:list[0]})).outcome,'blocked')
 assert.equal((await send(message)).outcome,'accepted')
})
test('rejects empty content, header injection and absent idempotency key',async()=>{
 let calls=0;const send=createSupportResendTransport({...options,fetchImpl:()=>{calls++}})
 for(const patch of [{subject:''},{subject:'bad\nheader'},{text:''},{idempotencyKey:''}]) assert.equal((await send({...message,...patch})).outcome,'blocked')
 assert.equal(calls,0)
})
test('posts minimal payload to fixed provider with redirect disabled',async()=>{
 const send=createSupportResendTransport({...options,fetchImpl:async(url,request)=>{
 assert.equal(url,'https://api.resend.com/emails');assert.equal(request.redirect,'error')
 assert.equal(request.headers['Idempotency-Key'],message.idempotencyKey)
 assert.equal(request.headers.Authorization,'Bearer re_test_only')
 assert.deepEqual(JSON.parse(request.body),{from:'ZRIHTAN <notifications@notify.zrihtan.com>',to:[to],subject:message.subject,text:message.text})
 return ok()
 }})
 assert.deepEqual(await send({...message,privateReply:'must not send'}),{outcome:'accepted',providerId:'test-provider-id'})
})
for(const status of [400,401,403,422,429,408,409,500,503,302]) test(`HTTP ${status} classified without automatic retry`,async()=>{
 let calls=0
 const send=createSupportResendTransport({...options,fetchImpl:async()=>{calls++;return {status,json:async()=>{throw Error('sensitive provider body')}}}})
 const result=await send(message)
 assert.equal(result.outcome,status===429?'rate_limited':[400,401,403,422].includes(status)?'rejected':'unknown')
 assert.equal(calls,1);assert.equal(JSON.stringify(result).includes('sensitive'),false)
})
test('network failures are ambiguous and sanitized',async()=>{
 const send=createSupportResendTransport({...options,fetchImpl:async()=>{throw Error('secret token and email')}})
 assert.deepEqual(await send(message),{outcome:'unknown'})
})
test('malformed accepted response is ambiguous',async()=>{
 for(const json of [async()=>({}),async()=>{throw Error('invalid JSON')}]) {
 const send=createSupportResendTransport({...options,fetchImpl:async()=>({status:200,json})})
 assert.deepEqual(await send(message),{outcome:'unknown'})
 }
})
test('timeout aborts request, never retries',async()=>{
 const send=createSupportResendTransport({...options,timeoutMs:5,fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}))})
 assert.deepEqual(await send(message),{outcome:'unknown'})
})
