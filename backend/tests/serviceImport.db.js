import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pool from '../src/database/pool.js'
import { previewServiceImport, confirmServiceImport } from '../src/services/serviceImportService.js'
import { createService, updateService, updateServiceActive } from '../src/services/serviceService.js'
import { createFixedTenantTestApp } from './helpers/fixedTenantTestApp.js'
import { createApp } from '../src/createApp.js'
import { up, down } from '../migrations/1793469600000_create-service-import-receipts.js'

after(() => pool.end())
const row = (overrides = {}) => ({row_id:'r1',name:'Šišanje',category:'Kosa',price_eur:'18,50',default_duration_minutes:30,...overrides})
const draft = (items = [row()]) => ({currency:'EUR',items})
const confirmed = (items = [row()], request_id = randomUUID()) => ({...draft(items),request_id})
async function fixture(run) {
  let salonId, userId
  try {
    const token = randomUUID()
    userId = Number((await pool.query(`INSERT INTO users (auth_provider,auth_subject,email,display_name)
      VALUES ('clerk',$1,$2,'Import test') RETURNING id`,[`import_${token}`,`import_${token}@example.test`])).rows[0].id)
    salonId = Number((await pool.query("INSERT INTO salons (name,timezone) VALUES ('Import test','Europe/Zagreb') RETURNING id")).rows[0].id)
    await run({salonId,userId})
  } finally {
    if (salonId) await pool.query('DELETE FROM salons WHERE id=$1',[salonId])
    if (userId) await pool.query('DELETE FROM users WHERE id=$1',[userId])
  }
}
async function counts(f) {
  const r = await pool.query(`SELECT
    (SELECT count(*)::int FROM services WHERE salon_id=$1) services,
    (SELECT count(*)::int FROM service_import_receipts WHERE salon_id=$1) receipts,
    (SELECT count(*)::int FROM employee_services WHERE salon_id=$1) qualifications`,[f.salonId])
  return r.rows[0]
}
async function api(app, run) {
  const server = app.listen(0)
  await new Promise(resolve=>server.once('listening',resolve))
  try {
    await run(async (endpoint, body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/services/import/${endpoint}`,{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
      })
      return {status:response.status,cache:response.headers.get('cache-control'),body:await response.json()}
    })
  } finally {
    server.closeAllConnections()
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
  }
}
const fixed = (f,role='owner') => createFixedTenantTestApp(f.salonId,{role,userId:f.userId})

test('import DB: preview reports missing duration and never writes', () => fixture(async f => {
  const result = await previewServiceImport({...f,body:draft([row({default_duration_minutes:''})])})
  assert.equal(result.ready_count,0)
  assert.equal(result.rows[0].default_duration_minutes,null)
  assert.deepEqual(await counts(f),{services:0,receipts:0,qualifications:0})
}))
test('import DB: confirmed batch stores exact amounts and no automatic qualifications', () => fixture(async f => {
  const result = await confirmServiceImport({...f,body:confirmed([row(),row({row_id:'r2',name:'Dodatak',category:'',price_eur:'0',default_duration_minutes:1})])})
  assert.equal(result.created_count,2)
  assert.equal(result.replayed,false)
  assert.deepEqual(result.services.map(s=>s.price_cents),[1850,0])
  assert.equal(result.services[1].category,'Ostalo')
  assert.ok(result.services.every(s=>Number(s.salon_id)===f.salonId && s.active))
  assert.deepEqual(await counts(f),{services:2,receipts:1,qualifications:0})
}))
test('import DB: one invalid row prevents the entire batch', () => fixture(async f => {
  await assert.rejects(confirmServiceImport({...f,body:confirmed([row(),row({row_id:'r2',name:'Drugo',default_duration_minutes:''})])}),{code:'SERVICE_IMPORT_INVALID'})
  assert.deepEqual(await counts(f),{services:0,receipts:0,qualifications:0})
}))
test('import DB: final receipt failure rolls back all service inserts', () => fixture(async f => {
  // Use a real formerly allocated ID so the final receipt FK fails after inserts.
  await pool.query('DELETE FROM users WHERE id=$1',[f.userId])
  await assert.rejects(confirmServiceImport({...f,body:confirmed([row(),row({row_id:'r2',name:'Drugo'})])}),{code:'23503'})
  assert.deepEqual(await counts(f),{services:0,receipts:0,qualifications:0})
}))
test('import DB: existing inactive service is reviewed; deliberate duplicate does not overwrite it', () => fixture(async f => {
  const old = await createService({...f,name:'ŠIŠANJE',category:'Kosa',priceCents:999,defaultDurationMinutes:10})
  await updateServiceActive({...f,serviceId:old.id,active:false})
  await assert.rejects(confirmServiceImport({...f,body:confirmed()}),{code:'SERVICE_IMPORT_REVIEW_REQUIRED'})
  const result = await confirmServiceImport({...f,body:confirmed([row({allow_duplicate:true})])})
  assert.notEqual(result.services[0].id,old.id)
  const retained = (await pool.query('SELECT active,price_cents FROM services WHERE id=$1',[old.id])).rows[0]
  assert.deepEqual(retained,{active:false,price_cents:999})
}))
test('import DB: same batch names require explicit confirmation for both rows', () => fixture(async f => {
  const items=[row(),row({row_id:'r2',category:'Drugo'})]
  await assert.rejects(confirmServiceImport({...f,body:confirmed(items)}),{code:'SERVICE_IMPORT_REVIEW_REQUIRED'})
  assert.equal((await counts(f)).services,0)
  assert.equal((await confirmServiceImport({...f,body:confirmed(items.map(r=>({...r,allow_duplicate:true})))})).created_count,2)
}))
test('import DB: preview is rechecked after a new catalogue entry', () => fixture(async f => {
  assert.equal((await previewServiceImport({...f,body:draft()})).ready_count,1)
  await createService({...f,name:'Šišanje',category:'Kosa',priceCents:100,defaultDurationMinutes:5})
  await assert.rejects(confirmServiceImport({...f,body:confirmed()}),{code:'SERVICE_IMPORT_REVIEW_REQUIRED'})
  assert.equal((await counts(f)).receipts,0)
}))
test('import DB: replay returns original snapshots even after editing the service', () => fixture(async f => {
  const body=confirmed()
  const first=await confirmServiceImport({...f,body})
  await updateService({...f,serviceId:first.services[0].id,name:'Changed',category:'New',priceCents:9900,defaultDurationMinutes:90})
  const second=await confirmServiceImport({...f,body})
  assert.deepEqual(second,{...first,replayed:true})
  assert.deepEqual(await counts(f),{services:1,receipts:1,qualifications:0})
}))
test('import DB: same request ID with changed content is rejected', () => fixture(async f => {
  const body=confirmed()
  await confirmServiceImport({...f,body})
  await assert.rejects(confirmServiceImport({...f,body:{...body,items:[row({price_eur:'19'})]}}),{code:'SERVICE_IMPORT_KEY_REUSED'})
  assert.equal((await counts(f)).services,1)
}))
test('import DB: another actor cannot replay an import receipt', () => fixture(async f => fixture(async other => {
  const body=confirmed()
  await confirmServiceImport({...f,body})
  await assert.rejects(confirmServiceImport({...f,userId:other.userId,body}),{code:'SERVICE_IMPORT_KEY_REUSED'})
})))
test('import DB: salons have independent duplicate checks and request IDs', () => fixture(async f => fixture(async other => {
  const body=confirmed()
  await confirmServiceImport({...f,body})
  assert.equal((await previewServiceImport({...other,body:draft()})).ready_count,1)
  const result=await confirmServiceImport({...other,body})
  assert.equal(result.replayed,false)
  assert.equal(Number(result.services[0].salon_id),other.salonId)
})))
test('import DB: simultaneous identical confirmation creates exactly one batch', () => fixture(async f => {
  const body=confirmed()
  const results=await Promise.all([confirmServiceImport({...f,body}),confirmServiceImport({...f,body})])
  assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true])
  assert.deepEqual(await counts(f),{services:1,receipts:1,qualifications:0})
}))
test('import DB: concurrent different requests cannot bypass duplicate recheck', () => fixture(async f => {
  const results=await Promise.allSettled([confirmServiceImport({...f,body:confirmed()}),confirmServiceImport({...f,body:confirmed()})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'SERVICE_IMPORT_REVIEW_REQUIRED')
  assert.deepEqual(await counts(f),{services:1,receipts:1,qualifications:0})
}))
for (const role of ['owner','admin']) test(`import API: ${role} can preview, confirm and replay`, () => fixture(async f => api(fixed(f,role),async request=>{
  const preview=await request('preview',draft())
  assert.equal(preview.status,200)
  assert.equal(preview.cache,'no-store')
  const body=confirmed()
  assert.equal((await request('confirm',body)).status,201)
  const replay=await request('confirm',body)
  assert.equal(replay.status,200)
  assert.equal(replay.body.data.replayed,true)
})))
test('import API: employee cannot preview or confirm', () => fixture(async f => api(fixed(f,'employee'),async request=>{
  assert.equal((await request('preview',draft())).status,403)
  assert.equal((await request('confirm',confirmed())).status,403)
  assert.equal((await counts(f)).services,0)
})))
test('import API: body cannot inject another salon or activation flag', () => fixture(async f => api(fixed(f),async request=>{
  assert.equal((await request('confirm',{...confirmed(),salon_id:123})).status,400)
  assert.equal((await request('confirm',confirmed([row({active:false})]))).status,400)
  assert.equal((await counts(f)).services,0)
})))
test('import API: inactive user or mismatched membership fails closed', () => fixture(async f => {
  for (const change of [req=>{req.currentUser.active=false},req=>{req.currentMembership.salonId=f.salonId+1},req=>{req.currentMembership.userId=f.userId+1}]) {
    const app=createApp({privateRouteMiddleware:[(req,res,next)=>{
      req.currentUser={id:f.userId,active:true}
      req.currentSalon={id:f.salonId,active:true}
      req.currentMembership={userId:f.userId,salonId:f.salonId,role:'owner',active:true}
      change(req);next()
    }]})
    await api(app,async request=>assert.equal((await request('confirm',confirmed())).status,403))
  }
  assert.equal((await counts(f)).services,0)
}))
test('import migration: empty down works; committed receipt prevents destructive down', async () => {
  const db=await pool.connect()
  const schema=`import_migration_${process.pid}_${Date.now()}`
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA "${schema}"`)
    await db.query(`SET LOCAL search_path TO "${schema}", public`)
    await db.query('CREATE TABLE salons(id bigint PRIMARY KEY); CREATE TABLE users(id bigint PRIMARY KEY); INSERT INTO salons VALUES(1); INSERT INTO users VALUES(1)')
    const apply=[],undo=[];up({sql:s=>apply.push(s)});down({sql:s=>undo.push(s)})
    await db.query(apply.join('\n'))
    await db.query(undo.join('\n'))
    await db.query(apply.join('\n'))
    await db.query('INSERT INTO service_import_receipts(salon_id,request_id,requested_by_user_id,request_hash,response) VALUES(1,$1,1,$2,$3)',[randomUUID(),'a'.repeat(64),'{}'])
    await db.query('SAVEPOINT guard_down')
    await assert.rejects(db.query(undo.join('\n')),/Cannot remove import receipts/)
    await db.query('ROLLBACK TO SAVEPOINT guard_down')
    assert.equal((await db.query('SELECT count(*)::int n FROM service_import_receipts')).rows[0].n,1)
  } finally { await db.query('ROLLBACK');db.release() }
})
