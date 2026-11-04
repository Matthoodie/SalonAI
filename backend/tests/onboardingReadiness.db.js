import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {createSalonCreationService} from '../src/services/salonCreationService.js'
import {createOnboardingReadinessService} from '../src/services/onboardingReadinessService.js'
import {updateSalonSetup} from '../src/services/salonSetupService.js'
after(()=>pool.end())
async function fixture(run){let uid,sid;try{
 const subject='user_'+randomUUID().replaceAll('-','')
 uid=(await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id",[subject,subject+'@example.test'])).rows[0].id
 const c=createSalonCreationService({environment:{SALON_CREATION_MODE:'allowlist',SALON_CREATION_ALLOWED_SUBJECTS:subject}})
 sid=(await c.create(uid,{request_id:randomUUID(),name:'Readiness test',timezone:'Europe/Zagreb',business_type:'hair',location:''})).salon_id
 await updateSalonSetup({userId:uid,salonId:sid,body:{expected_revision:1,business_type:'hair',location:'',team_mode:'solo',owner_provides_services:true,last_step:'review'}})
 const employee=(await pool.query("INSERT INTO employees(salon_id,name) VALUES ($1,'Test performer') RETURNING id",[sid])).rows[0].id
 const service=(await pool.query("INSERT INTO services(salon_id,name,category,price_cents,default_duration_minutes) VALUES ($1,'Test service','Test',1000,30) RETURNING id",[sid])).rows[0].id
 const ready=createOnboardingReadinessService()
 const qualify=async()=>{await pool.query('INSERT INTO employee_services(salon_id,employee_id,service_id) VALUES ($1,$2,$3)',[sid,employee,service]);await pool.query("INSERT INTO employee_working_hours(employee_id,day_of_week,start_time,end_time) VALUES ($1,1,'09:00','17:00')",[employee])}
 await run({uid,sid,employee,service,ready,qualify})
 }finally{if(sid)await pool.query('DELETE FROM salons WHERE id=$1',[sid]);if(uid)await pool.query('DELETE FROM users WHERE id=$1',[uid])}}
test('readiness DB: persisted review cursor cannot complete unqualified salon',()=>fixture(async f=>{const r=await f.ready.read(f.uid,f.sid);assert.equal(r.ready,false);assert.equal(r.counts.uncovered_services,1);await assert.rejects(f.ready.complete(f.uid,f.sid,{expected_revision:2}),{code:'SALON_ONBOARDING_NOT_READY'});assert.equal((await f.ready.read(f.uid,f.sid)).status,'in_progress')}))
test('readiness DB: complete and replay persist completion time',()=>fixture(async f=>{await f.qualify();assert.equal((await f.ready.read(f.uid,f.sid)).ready,true);assert.equal((await f.ready.complete(f.uid,f.sid,{expected_revision:2})).status,'completed');const first=(await pool.query('SELECT completed_at FROM salon_onboarding WHERE salon_id=$1',[f.sid])).rows[0].completed_at;await f.ready.complete(f.uid,f.sid,{expected_revision:2});assert.deepEqual((await pool.query('SELECT completed_at FROM salon_onboarding WHERE salon_id=$1',[f.sid])).rows[0].completed_at,first)}))
test('readiness DB: qualification without weekly schedule is incomplete',()=>fixture(async f=>{await f.qualify();await pool.query('DELETE FROM employee_working_hours WHERE employee_id=$1',[f.employee]);assert.equal((await f.ready.read(f.uid,f.sid)).ready,false)}))
test('readiness DB: inactive employee cannot cover service',()=>fixture(async f=>{await f.qualify();await pool.query('UPDATE employees SET active=false WHERE id=$1',[f.employee]);assert.equal((await f.ready.read(f.uid,f.sid)).ready,false)}))
test('readiness DB: stale setup revision is rejected',()=>fixture(async f=>{await f.qualify();await assert.rejects(f.ready.complete(f.uid,f.sid,{expected_revision:1}),{code:'SALON_SETUP_VERSION_CONFLICT'});assert.equal((await f.ready.read(f.uid,f.sid)).status,'in_progress')}))
test('readiness DB: admin cannot complete owner onboarding',()=>fixture(async f=>{await f.qualify();await pool.query("UPDATE salon_memberships SET role='admin' WHERE user_id=$1 AND salon_id=$2",[f.uid,f.sid]);await assert.rejects(f.ready.read(f.uid,f.sid),{code:'SALON_ONBOARDING_FORBIDDEN'});await assert.rejects(f.ready.complete(f.uid,f.sid,{expected_revision:2}),{code:'SALON_ONBOARDING_FORBIDDEN'})}))
test('readiness DB: legacy salon not enrolled by completion',()=>fixture(async f=>{await pool.query('DELETE FROM salon_onboarding WHERE salon_id=$1',[f.sid]);assert.equal((await f.ready.complete(f.uid,f.sid,{expected_revision:2})).status,'not_required');assert.equal((await pool.query('SELECT count(*)::int AS n FROM salon_onboarding WHERE salon_id=$1',[f.sid])).rows[0].n,0)}))
test('readiness DB: changes after preview are rechecked at completion',()=>fixture(async f=>{await f.qualify();assert.equal((await f.ready.read(f.uid,f.sid)).ready,true);await pool.query('UPDATE services SET active=false WHERE id=$1',[f.service]);await assert.rejects(f.ready.complete(f.uid,f.sid,{expected_revision:2}),{code:'SALON_ONBOARDING_NOT_READY'})}))
test('readiness DB: foreign salon and inactive owner are rejected',()=>fixture(async f=>{
 await f.qualify();const foreign=(await pool.query("INSERT INTO salons(name,timezone) VALUES ('Foreign readiness test','Europe/Zagreb') RETURNING id")).rows[0].id
 try{await assert.rejects(f.ready.read(f.uid,foreign),{code:'SALON_ONBOARDING_FORBIDDEN'})}finally{await pool.query('DELETE FROM salons WHERE id=$1',[foreign])}
 await pool.query('UPDATE users SET active=false WHERE id=$1',[f.uid]);await assert.rejects(f.ready.complete(f.uid,f.sid,{expected_revision:2}),{code:'SALON_ONBOARDING_FORBIDDEN'})
}))
