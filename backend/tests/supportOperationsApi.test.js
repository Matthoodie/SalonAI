import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {randomUUID} from 'node:crypto'
import {createSupportOperationsRouter} from '../src/routes/supportOperationsRoutes.js'
import {createSupportTicketRouter} from '../src/routes/supportTicketRoutes.js'
import {supportOperation,operationQuery} from '../src/utils/supportOperations.js'
import {supportId} from '../src/utils/supportTicketValidation.js'
async function fixture(run,{user={id:'7',active:true},overrides={},mounted=false}={}) {
 const calls=[],authenticate=(req,res,next)=>{req.currentUser=user;next()}
 const service={access:async id=>{calls.push(['access',id]);return {allowed:true}},list:async(id,q)=>{operationQuery(q);calls.push(['list',id]);return {tickets:[]}},
 detail:async(id,tid)=>{supportId(tid);calls.push(['detail',id]);return {id:tid}},
 messages:async(id,tid,q,operator)=>{supportId(tid);operationQuery(q,true);calls.push(['messages',id,operator]);return {messages:[]}},
 apply:async(id,tid,body)=>{supportId(tid);supportOperation(body);calls.push(['apply',id]);return {replayed:false}},...overrides}
 const router=createSupportOperationsRouter({authenticate,service})
 let app,privateCalls=0,authCalls=0
 if(mounted){const {createApp}=await import('../src/createApp.js');app=createApp({supportOperationsRouter:router,authRouteMiddleware:[(req,res,next)=>{authCalls++;next()}],privateRouteMiddleware:[(req,res)=>{privateCalls++;res.sendStatus(403)}]})}
 else{app=express();app.use('/api/support/operations',router);app.use('/api/support/tickets',createSupportTicketRouter({authenticate,conversation:service}));app.use(express.json());app.use((err,req,res,next)=>res.sendStatus(599))}
 const server=app.listen(0);await new Promise(r=>server.once('listening',r))
 const url=`http://127.0.0.1:${server.address().port}`
 try{await run(url,calls,()=>({privateCalls,authCalls}))}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
}
const operation=()=>({request_id:randomUUID(),expected_revision:1,kind:'reply',body:'Hello from support'})
const post=(url,body)=>fetch(url+'/api/support/operations/tickets/8/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
test('operations API: authenticated actor only and no-store',()=>fixture(async(url,calls)=>{
 const response=await post(url,operation());assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(calls,[['apply','7']])
}))
test('operations API: replay is 200',()=>fixture(async url=>assert.equal((await post(url,operation())).status,200),{overrides:{apply:async()=>({replayed:true})}}))
test('operations API: unauthenticated and inactive denied',async()=>{
 for(const [user,status] of [[null,401],[{id:7,active:false},403]])await fixture(async(url,calls)=>{assert.equal((await post(url,operation())).status,status);assert.equal(calls.length,0)},{user})
})
test('operations API: privilege denial is safe 403',()=>fixture(async url=>{
 const response=await fetch(url+'/api/support/operations/tickets');assert.equal(response.status,403);assert.ok(!(await response.text()).includes('private'))
},{overrides:{list:async()=>{throw Object.assign(Error('private'),{code:'SUPPORT_OPERATOR_FORBIDDEN'})}}}))
test('operations API: actor injection and invalid cursors rejected',()=>fixture(async(url,calls)=>{
 assert.equal((await post(url,{...operation(),operator_user_id:9})).status,400)
 for(const path of ['/tickets?before=1&before=2','/tickets?status=no','/tickets/abc','/tickets/8/messages?before=2','/access?user_id=1'])assert.equal((await fetch(url+'/api/support/operations'+path)).status,400)
 assert.equal(calls.length,0)
}))
test('operations API: malformed oversized compressed and non-JSON bodies safely rejected',()=>fixture(async url=>{
 const endpoint=url+'/api/support/operations/tickets/8/operations'
 for(const [body,headers,status] of [['{"secret":',{'Content-Type':'application/json'},400],['x'.repeat(33000),{'Content-Type':'application/json'},413],['x',{},415],['x',{'Content-Type':'application/json','Content-Encoding':'gzip'},415]]){
  const r=await fetch(endpoint,{method:'POST',headers,body});assert.equal(r.status,status);assert.ok(!(await r.text()).includes('secret'))
 }
}))
test('operations API: conflict preserves safe code',()=>fixture(async url=>{
 const r=await post(url,operation());assert.equal(r.status,409);assert.equal((await r.json()).error.code,'SUPPORT_REVISION_CONFLICT')
},{overrides:{apply:async()=>{throw Object.assign(Error('hidden'),{code:'SUPPORT_REVISION_CONFLICT'})}}}))
test('operations API: author and operator conversation paths enforce distinct modes',()=>fixture(async(url,calls)=>{
 assert.equal((await fetch(url+'/api/support/tickets/8/messages')).status,200)
 assert.equal((await fetch(url+'/api/support/operations/tickets/8/messages')).status,200)
 assert.deepEqual(calls,[['messages','7',false],['messages','7',true]])
}))
test('operations API: mounted before global parser without salon gate',()=>fixture(async(url,calls,counters)=>{
 assert.equal((await fetch(url+'/api/support/operations/access')).status,200)
 const r=await fetch(url+'/api/support/operations/tickets/8/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"secret":'})
 assert.equal(r.status,400);assert.deepEqual(counters(),{privateCalls:0,authCalls:2})
},{mounted:true}))
test('operations API: no grant or destructive routes exposed',()=>fixture(async(url,calls)=>{
 for(const [path,method] of [['/grant','POST'],['/tickets/8','DELETE'],['/tickets/8','PATCH']])assert.equal((await fetch(url+'/api/support/operations'+path,{method})).status,404)
 assert.equal(calls.length,0)
}))
