import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {randomUUID} from 'node:crypto'
import {createSupportTicketRouter} from '../src/routes/supportTicketRoutes.js'
import {validateSupportTicket,validateSupportListQuery,supportId} from '../src/utils/supportTicketValidation.js'
const draft=()=>({request_id:randomUUID(),category:'help',subject:'Need some help',description:'Please explain how to set the working hours.',language:'en'})
async function fixture(run,{user={id:'7',active:true},service:overrides={},authenticate}={}) {
 const calls=[], app=express()
 const service={create:async(id,body)=>{const d=validateSupportTicket(body);calls.push(['create',id,d]);return {ticket:{id:'8',status:'open'},replayed:false}},
 list:async(id,q)=>{validateSupportListQuery(q);calls.push(['list',id,q]);return {tickets:[],next_before:null}},
 detail:async(id,tid)=>{supportId(tid);calls.push(['detail',id,tid]);return {id:tid}},...overrides}
 app.use('/api/support/tickets',createSupportTicketRouter({authenticate:authenticate??((req,res,next)=>{req.currentUser=user;next()}),service}))
 // Mirrors placement before general parsing; malformed support JSON must never reach this logger.
 app.use(express.json());app.use((err,req,res,next)=>res.status(599).end())
 const server=app.listen(0);await new Promise(r=>server.once('listening',r))
 const url=`http://127.0.0.1:${server.address().port}/api/support/tickets`
 try{await run(url,calls)}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
}
const post=(url,body)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
test('support API new account ticket 201 and private no-store response',()=>fixture(async(url,calls)=>{
 const r=await post(url,draft());assert.equal(r.status,201);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).replayed,false);assert.equal(calls[0][1],'7')
}))
test('support API idempotent replay is 200',()=>fixture(async url=>{assert.equal((await post(url,draft())).status,200)}, {service:{create:async()=>({ticket:{id:'8'},replayed:true})}}))
test('support API list and detail derive author from session',()=>fixture(async(url,calls)=>{
 assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url+'/8')).status,200)
 assert.deepEqual(calls.map(c=>c.slice(0,2)),[['list','7'],['detail','7']])
}))
test('support API no authenticated user denied before payload processing',()=>fixture(async(url,calls)=>{
 const r=await post(url,draft());assert.equal(r.status,401);assert.equal(calls.length,0);assert.equal(r.headers.get('cache-control'),'no-store')
},{user:null}))
test('support API inactive account denied',()=>fixture(async url=>{assert.equal((await fetch(url)).status,403)},{user:{id:'7',active:false}}))
test('support API malicious body fields rejected without service mutation',()=>fixture(async(url,calls)=>{
 for(const key of ['user_id','status','email','attachments'])assert.equal((await post(url,{...draft(),[key]:'forged'})).status,400)
 assert.equal(calls.length,0)
}))
test('support API filters duplicate cursors and invalid detail IDs rejected',()=>fixture(async url=>{
 for(const path of ['?salon_id=1','?before=1&before=2','/abc','/8?user_id=1'])assert.equal((await fetch(url+path)).status,400)
 assert.equal((await post(url+'?before=1',draft())).status,400)
}))
test('support API 32 KiB limit and malformed JSON return safe local errors',()=>fixture(async url=>{
 for(const [body,status] of [['{"subject":"secret",',400],[JSON.stringify({description:'x'.repeat(33000)}),413]]){
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(r.status,status)
 const text=await r.text();assert.equal(text.includes('secret'),false);assert.equal(text.includes('description'),false);assert.equal(r.headers.get('cache-control'),'no-store')
 }
}))
test('support API plain text and compressed payload refused',()=>fixture(async url=>{
 assert.equal((await fetch(url,{method:'POST',body:'plain'})).status,415)
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:'fake'})).status,415)
}))
test('support API conflict and not-found codes retain status without leaking messages',async()=>{
 for(const [code,status] of [['SUPPORT_REQUEST_CONFLICT',409],['SUPPORT_NOT_FOUND',404],['SUPPORT_RATE_LIMITED',429]])await fixture(async url=>{
 const r=await post(url,draft());assert.equal(r.status,status);const body=await r.json();assert.equal(body.error.code,code);assert.equal(JSON.stringify(body).includes('private text'),false)
 if(status===429)assert.equal(r.headers.get('retry-after'),'3600')
 },{service:{create:async()=>{throw Object.assign(Error('private text'),{code,statusCode:status})}}})
})
test('support API unexpected database error is sanitized without logging parameters',()=>fixture(async url=>{
 const logs=[],old=console.error;console.error=(...args)=>logs.push(args)
 try{const r=await post(url,draft());assert.equal(r.status,500);assert.equal((await r.text()).includes('secret sql'),false);assert.equal(JSON.stringify(logs).includes('secret sql'),false)}finally{console.error=old}
},{service:{create:async()=>{throw Error('secret sql')}}}))
test('support API no update delete or staff access endpoints',()=>fixture(async(url,calls)=>{
 for(const method of ['PATCH','PUT','DELETE'])assert.equal((await fetch(url+'/8',{method})).status,404)
 assert.equal((await fetch(url+'/8/replies')).status,404);assert.equal(calls.length,0)
}))

test('support mounted app uses auth middleware but not salon middleware and bounds JSON before global parser',async()=>{
 const {createApp}=await import('../src/createApp.js')
 let authCalls=0,privateCalls=0
 const router=createSupportTicketRouter({authenticate:(req,res,next)=>{req.currentUser={id:'7',active:true};next()},service:{list:async()=>({tickets:[],next_before:null})}})
 const app=createApp({supportRouter:router,authRouteMiddleware:[(req,res,next)=>{authCalls++;next()}],privateRouteMiddleware:[(req,res,next)=>{privateCalls++;res.sendStatus(403)}]})
 const server=app.listen(0);await new Promise(r=>server.once('listening',r))
 try{
  const url=`http://127.0.0.1:${server.address().port}/api/support/tickets`
  assert.equal((await fetch(url)).status,200)
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"secret":'})).status,400)
  assert.equal(authCalls,2);assert.equal(privateCalls,0)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})
