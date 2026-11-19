import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {createSupportAccessService,requireSupportAccess} from '../src/services/supportAccessService.js'
import * as repository from '../src/repositories/supportAccessRepository.js'
after(()=>pool.end())
const service=createSupportAccessService({dbPool:pool})
async function fixture(run){
 const database=(await pool.query('SELECT current_database() AS name')).rows[0].name
 assert.ok(database==='salonai_regression'||/(^|[_-])test([_-]|$)/i.test(database),'Support access DB tests require a named TEST database')
 const subject='user_Support'+randomUUID().replaceAll('-','')
 let userId
 try{
  const row=(await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id",[subject,randomUUID()+'@example.test'])).rows[0]
  userId=String(row.id)
  const change=(patch={})=>({subject,action:'grant',expectedRevision:0,reason:'Synthetic database test access',...patch})
  const options={database,apply:true}
  const audit=async()=> (await pool.query('SELECT * FROM platform_support_access_audit WHERE target_user_id_snapshot=$1 ORDER BY revision',[userId])).rows
  const authorize=async()=>{
   const db=await pool.connect()
   try{await db.query('BEGIN');return await requireSupportAccess(db,userId)}finally{await db.query('ROLLBACK');db.release()}
  }
  await run({userId,subject,database,change,options,audit,authorize})
 }finally{
  if(userId){await pool.query('DELETE FROM platform_support_access_audit WHERE target_user_id_snapshot=$1',[userId]);await pool.query('DELETE FROM users WHERE id=$1',[userId])}
 }
}
test('support access DB: migration has no automatic grant; preview is read-only',()=>fixture(async f=>{
 assert.equal((await service.inspect(f.subject,f.database)).revision,0)
 await assert.rejects(f.authorize(),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 const preview=await service.change(f.change(),{database:f.database})
 assert.equal(preview.applied,false);assert.equal((await service.inspect(f.subject,f.database)).revision,0);assert.equal((await f.audit()).length,0)
}))
test('support access DB: grant authorizes account without membership and records database actor',()=>fixture(async f=>{
 await service.change(f.change(),f.options)
 assert.deepEqual(await f.authorize(),{userId:f.userId,revision:1})
 const events=await f.audit(),identity=await repository.databaseIdentity(pool)
 assert.equal(events.length,1);assert.equal(events[0].actor_database_role,identity.role);assert.equal(events[0].actor_kind,'database_operator');assert.equal(events[0].previous_enabled,false);assert.equal(events[0].enabled,true)
}))
test('support access DB: revoke then regrant advances revisions and access',()=>fixture(async f=>{
 await service.change(f.change(),f.options)
 await service.change(f.change({action:'revoke',expectedRevision:1}),f.options)
 await assert.rejects(f.authorize(),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 await service.change(f.change({expectedRevision:2}),f.options)
 assert.equal((await f.authorize()).revision,3);assert.deepEqual((await f.audit()).map(r=>r.action),['grant','revoke','grant'])
}))
test('support access DB: no-op and stale commands cannot create extra audit events',()=>fixture(async f=>{
 assert.equal((await service.change(f.change({action:'revoke'}),f.options)).changed,false)
 await service.change(f.change(),f.options)
 assert.equal((await service.change(f.change({expectedRevision:1}),f.options)).changed,false)
 await assert.rejects(service.change(f.change({action:'revoke'}),f.options),{code:'SUPPORT_ACCESS_REVISION_CONFLICT'})
 assert.equal((await f.audit()).length,1)
}))
test('support access DB: two concurrent grants create exactly one revision',()=>fixture(async f=>{
 const results=await Promise.allSettled([service.change(f.change(),f.options),service.change(f.change(),f.options)])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'SUPPORT_ACCESS_REVISION_CONFLICT')
 assert.equal((await f.audit()).length,1);assert.equal((await f.authorize()).revision,1)
}))
test('support access DB: audit error rolls back grant',()=>fixture(async f=>{
 const failing=createSupportAccessService({dbPool:pool,repo:{...repository,appendSupportAccessAudit:async()=>{throw Error('synthetic audit failure')}}})
 await assert.rejects(failing.change(f.change(),f.options))
 assert.equal((await service.inspect(f.subject,f.database)).revision,0);assert.equal((await f.audit()).length,0)
}))
test('support access DB: inactive or rebound identity loses access',()=>fixture(async f=>{
 await service.change(f.change(),f.options)
 await pool.query('UPDATE users SET active=false WHERE id=$1',[f.userId])
 await assert.rejects(f.authorize(),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
 await assert.rejects(service.change(f.change({expectedRevision:1}),f.options),{code:'SUPPORT_ACCESS_TARGET_INACTIVE'})
 await service.change(f.change({action:'revoke',expectedRevision:1}),f.options)
 await pool.query('UPDATE users SET active=true WHERE id=$1',[f.userId]);await service.change(f.change({expectedRevision:2}),f.options)
 await pool.query('UPDATE users SET auth_subject=$2 WHERE id=$1',[f.userId,'user_Rebound'+randomUUID().replaceAll('-','')])
 await assert.rejects(f.authorize(),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
}))
test('support access DB: wrong database guard never changes access',()=>fixture(async f=>{
 await assert.rejects(service.change(f.change(),{...f.options,database:f.database+'_wrong'}),{code:'SUPPORT_ACCESS_DATABASE'})
 assert.equal((await f.audit()).length,0)
}))
test('support access DB: audit survives account deletion without an identifying email',()=>fixture(async f=>{
 await service.change(f.change(),f.options);await pool.query('DELETE FROM users WHERE id=$1',[f.userId])
 const events=await f.audit();assert.equal(events.length,1);assert.equal(events[0].target_user_id,null);assert.equal(String(events[0].target_user_id_snapshot),f.userId)
 assert.equal((await pool.query('SELECT * FROM platform_support_access WHERE user_id=$1',[f.userId])).rows.length,0)
}))
test('support access DB: authorized transaction holds account lock until completion',()=>fixture(async f=>{
 await service.change(f.change(),f.options)
 const reader=await pool.connect(),writer=await pool.connect()
 try{
  await reader.query('BEGIN');await requireSupportAccess(reader,f.userId)
  await writer.query('BEGIN');await writer.query("SET LOCAL lock_timeout='100ms'")
  await assert.rejects(repository.findSupportIdentity(writer,f.subject,true),e=>e.code==='55P03')
 }finally{await writer.query('ROLLBACK');writer.release();await reader.query('ROLLBACK');reader.release()}
 await service.change(f.change({action:'revoke',expectedRevision:1}),f.options)
 await assert.rejects(f.authorize(),{code:'SUPPORT_OPERATOR_FORBIDDEN'})
}))
