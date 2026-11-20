import test from 'node:test'
import assert from 'node:assert/strict'
import {deliveryRequest,contactMatches,safeDeliveryOutcome} from '../src/utils/supportDelivery.js'
import {createSupportDeliveryService} from '../src/services/supportDeliveryService.js'
const selection={eventId:'1',authorId:'2',activationAfter:'2026-11-20T00:00:00.000Z',allowedRecipient:'test@example.com'}
const contact={subject:'user_test',email:selection.allowedRecipient,verified:true}
function fixture(overrides={}){
 const calls=[]
 const db={query:async sql=>{calls.push(sql)},release:()=>calls.push('release')}
 const dbPool={connect:async()=>db}
 const repo={
 readDeliveryIdentity:async()=>({active:true,auth_provider:'clerk',auth_subject:contact.subject}),
 lockDeliveryEvent:async()=>({id:'1',state:'held',account_active:true,auth_provider:'clerk',auth_subject:contact.subject,ticket_id:'20',language:'hr',created_at:'2026-11-20T01:00:00Z'}),
 prepareDelivery:async(_db,_row,payload)=>{calls.push(payload);return {state:'ready'}},
 claimDelivery:async()=>({state:'sending',token:'token',payload:{to:contact.email,subject:'frozen',text:'frozen',idempotencyKey:'support-reply/test-key'}}),
 finishDelivery:async(_db,_id,_token,result)=>{calls.push(result);return {state:result.outcome}},
 ...overrides.repo,
 }
 const service=createSupportDeliveryService({enabled:true,dbPool,repo,resolveVerifiedContact:async()=>contact,send:async()=>{calls.push('SEND');return {outcome:'accepted',providerId:'id'}},...overrides,repo})
 return {service,calls}
}
test('delivery defaults off, no dependencies or I/O',async()=>{
 const service=createSupportDeliveryService()
 assert.deepEqual(await service.prepare(),{state:'disabled'});assert.deepEqual(await service.runOne(),{state:'disabled'})
})
test('selection requires explicit event, author, email and UTC activation',()=>{
 assert.equal(deliveryRequest(selection).eventId,'1')
 for(const patch of [{eventId:0},{authorId:-1},{activationAfter:'yesterday'},{activationAfter:'2026-11-20'},{allowedRecipient:'a@b\nBcc:c@d'}]) assert.throws(()=>deliveryRequest({...selection,...patch}))
})
test('unverified, changed and wrong-subject contacts fail',()=>{
 assert.equal(contactMatches(contact,'user_test',contact.email),true)
 for(const patch of [{verified:false},{subject:'other'},{email:'other@example.com'}])assert.equal(contactMatches({...contact,...patch},'user_test',contact.email),false)
})
test('outcome sanitation discards provider error data',()=>{
 assert.deepEqual(safeDeliveryOutcome({outcome:'accepted',providerId:'id',secret:'x'}),{outcome:'accepted',providerId:'id'})
 for(const value of [null,{}, {outcome:'accepted',providerId:'bad\nsecret'}, {outcome:'unexpected',secret:'x'}])assert.deepEqual(safeDeliveryOutcome(value),{outcome:'unknown',providerId:null})
})
test('prepare commits minimal translated notification without reply body',async()=>{
 const f=fixture();assert.deepEqual(await f.service.prepare(selection),{state:'ready'})
 const payload=f.calls.find(x=>typeof x==='object')
 assert.equal(payload.recipient,contact.email);assert.match(payload.subject,/#20/);assert.match(payload.text,/Pomoć/)
 assert.equal('body' in payload,false);assert.deepEqual(f.calls.slice(-2),['COMMIT','release'])
})
test('recipient mismatch blocks before transaction',async()=>{
 const f=fixture({resolveVerifiedContact:async()=>({...contact,email:'other@example.com'})})
 assert.equal((await f.service.prepare(selection)).state,'blocked');assert.deepEqual(f.calls,[])
})
test('verification error does not send or acquire a claim',async()=>{
 const f=fixture({resolveVerifiedContact:async()=>{throw Error('verification unavailable')}})
 await assert.rejects(f.service.runOne(selection));assert.deepEqual(f.calls,[])
})
test('inactive account blocks before contact lookup',async()=>{
 const f=fixture({repo:{readDeliveryIdentity:async()=>({active:false})},resolveVerifiedContact:async()=>{throw Error('must not call')}})
 assert.equal((await f.service.runOne(selection)).state,'blocked');assert.deepEqual(f.calls,[])
})
test('account rechecked after contact lookup',async()=>{
 const f=fixture({repo:{lockDeliveryEvent:async()=>({account_active:false})}})
 assert.equal((await f.service.runOne(selection)).state,'blocked');assert.equal(f.calls.includes('SEND'),false)
})
test('claim commits before send; finish in separate transaction',async()=>{
 const f=fixture();assert.equal((await f.service.runOne(selection)).state,'accepted')
 assert.deepEqual(f.calls.slice(0,5),['BEGIN','COMMIT','release','SEND','BEGIN'])
})
test('claim failure rolls back and never sends',async()=>{
 const f=fixture({repo:{claimDelivery:async()=>{throw Error('claim failed')}}})
 await assert.rejects(f.service.runOne(selection),/claim failed/)
 assert.deepEqual(f.calls,['BEGIN','ROLLBACK','release'])
})
for(const state of ['held','sending','accepted','rejected','uncertain','suppressed'])test(`claim without token (${state}) never calls transport`,async()=>{
 const f=fixture({repo:{claimDelivery:async()=>({state})}})
 assert.equal((await f.service.runOne(selection)).state,state);assert.equal(f.calls.includes('SEND'),false)
})
test('network exception becomes unknown; details never saved',async()=>{
 const f=fixture({send:async()=>{throw Error('private secret')}})
 assert.equal((await f.service.runOne(selection)).state,'unknown');assert.equal(JSON.stringify(f.calls).includes('private secret'),false)
})
test('completion DB failure does not repeat transport',async()=>{
 const f=fixture({repo:{finishDelivery:async()=>{throw Error('DB unavailable')}}})
 await assert.rejects(f.service.runOne(selection),/DB unavailable/)
 assert.equal(f.calls.filter(x=>x==='SEND').length,1);assert.deepEqual(f.calls.slice(-2),['ROLLBACK','release'])
})
test('activation cutoff blocks old event before claim',async()=>{
 const f=fixture();assert.equal((await f.service.runOne({...selection,activationAfter:'2026-11-21T00:00:00Z'})).reason,'before_activation')
 assert.equal(f.calls.includes('SEND'),false)
})
