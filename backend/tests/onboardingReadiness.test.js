import test from 'node:test'
import assert from 'node:assert/strict'
import {completionRevision,evaluateReadiness} from '../src/utils/onboardingReadiness.js'
const setup={business_type:'hair',team_mode:'solo',owner_provides_services:true}
const counts={employees:1,services:1,uncovered_services:0}
test('onboarding: cursor is not proof of readiness',()=>{const r=evaluateReadiness({last_step:'review'},{employees:0,services:0,uncovered_services:0});assert.equal(r.ready,false);assert.deepEqual([...new Set(r.issues.map(i=>i.step))],['salon','team','services'])})
test('onboarding: actual qualified scheduled service allows readiness',()=>assert.deepEqual(evaluateReadiness(setup,counts),{ready:true,issues:[]}))
test('onboarding: uncovered service blocks completion',()=>assert.equal(evaluateReadiness(setup,{...counts,uncovered_services:1}).issues[0].step,'schedule'))
test('onboarding: solo means one active performer and working owner',()=>{assert.equal(evaluateReadiness(setup,{...counts,employees:2}).ready,false);assert.equal(evaluateReadiness({...setup,owner_provides_services:false},counts).ready,false)})
test('onboarding: team permits nonperforming owner but needs actual employee',()=>{assert.equal(evaluateReadiness({...setup,team_mode:'team',owner_provides_services:false},counts).ready,true);assert.equal(evaluateReadiness({...setup,team_mode:'team'},{...counts,employees:0}).ready,false)})
test('onboarding: completion body rejects identity and invalid revisions',()=>{for(const b of [null,[],{}, {expected_revision:0},{expected_revision:1.1},{expected_revision:1,salon_id:2},{expected_revision:'1'}])assert.throws(()=>completionRevision(b));assert.equal(completionRevision({expected_revision:7}),7)})

import {createOnboardingReadinessService} from '../src/services/onboardingReadinessService.js'
import {createSalonOnboardingRouter} from '../src/routes/salonOnboardingRoutes.js'
import express from 'express'
test('onboarding: transaction denies stale owner, rolls back and releases',async()=>{
 const calls=[];const db={query:async sql=>{calls.push(sql);return {rows:[]}},release:()=>calls.push('release')}
 await assert.rejects(createOnboardingReadinessService({dbPool:{connect:async()=>db}}).read(1,2),{code:'SALON_ONBOARDING_FORBIDDEN'})
 assert.equal(calls[0],'BEGIN ISOLATION LEVEL REPEATABLE READ');assert.deepEqual(calls.slice(-2),['ROLLBACK','release'])
})
test('onboarding API: completion gets identity from authenticated context only',async()=>{
 let call;const app=express();app.use(express.json());app.use('/api/salon-onboarding',createSalonOnboardingRouter({authenticate:(req,res,next)=>{req.currentUser={id:1,active:true};next()},selectSalon:(req,res,next)=>{req.currentSalon={id:2};next()},readiness:{complete:async(...args)=>{call=args;completionRevision(args[2]);return {status:'completed'}}}}));app.use((e,req,res,next)=>res.status(e.statusCode||500).json({code:e.code}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{
 const url='http://127.0.0.1:'+server.address().port+'/api/salon-onboarding/complete'
 const ok=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_revision:2})});assert.equal(ok.status,200);assert.deepEqual(call,[1,2,{expected_revision:2}]);assert.equal(ok.headers.get('cache-control'),'no-store')
 const bad=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_revision:2,user_id:9})});assert.equal(bad.status,400)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})
