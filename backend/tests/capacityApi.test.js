import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {createCapacityRouter} from '../src/routes/capacityRoutes.js'
async function fixture(run,context={}) {
 const calls=[],app=express()
 app.use((req,res,next)=>{req.currentUser={id:2,active:true};req.currentSalon={id:1,active:true};req.currentMembership={userId:2,salonId:1,active:true,role:'owner'};Object.assign(req,context);next()})
 app.use('/api/dashboard/capacity',createCapacityRouter({service:async(...args)=>{calls.push(args);return {ok:true}}}))
 app.use((error,req,res,next)=>res.status(error.statusCode||500).json({error:{code:error.code}}))
 const server=app.listen(0);await new Promise(r=>server.once('listening',r))
 try{await run(`http://127.0.0.1:${server.address().port}/api/dashboard/capacity`,calls)}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
}
test('capacity API: owner and admin read with no-store and server-derived identities',async()=>{
 for(const role of ['owner','admin'])await fixture(async(url,calls)=>{const r=await fetch(url+'?days=14');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.deepEqual(calls[0][0],{salonId:'1',userId:'2'})}, {currentMembership:{userId:2,salonId:1,active:true,role}})
})
test('capacity API: missing context employee inactive and mismatched membership denied',async()=>{
 for(const context of [{currentUser:null},{currentMembership:{role:'employee',userId:2,salonId:1,active:true}},
 {currentMembership:{role:'owner',userId:2,salonId:99,active:true}},{currentUser:{id:2,active:false}},
 {currentMembership:{role:'owner',userId:2,salonId:1,active:false}},{currentSalon:{id:1,active:false}}])await fixture(async(url,calls)=>{assert.equal((await fetch(url)).status,403);assert.equal(calls.length,0)},context)
})
test('capacity API: injected salon identity as-of duplicate and invalid days rejected',()=>fixture(async(url,calls)=>{
 for(const query of ['?salon_id=9','?as_of=2030-01-01','?days=7&days=14','?days=0','?days=07'])assert.equal((await fetch(url+query)).status,400)
 assert.equal(calls.length,0)
}))
test('capacity API: mutation methods are not exposed',()=>fixture(async(url,calls)=>{
 for(const method of ['POST','PUT','DELETE'])assert.equal((await fetch(url,{method})).status,404)
 assert.equal(calls.length,0)
}))
