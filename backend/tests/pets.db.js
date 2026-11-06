import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {getClientPets,createClientPet,updateClientPet,setClientPetActive} from '../src/services/petService.js'
import {createFixedTenantTestApp} from './helpers/fixedTenantTestApp.js'
after(()=>pool.end())
const draft=extra=>({name:'Luna',species:'dog',breed:'Mješanac',notes:'Mirna.',...extra})
async function fixture(run){
  const salons=[],users=[]
  try{
    for(let i=0;i<2;i++){
      const token=randomUUID()
      users.push(Number((await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id",['pets_'+token,token+'@example.test'])).rows[0].id))
      salons.push(Number((await pool.query("INSERT INTO salons(name,timezone) VALUES ('Pets test','Europe/Zagreb') RETURNING id")).rows[0].id))
      await pool.query("INSERT INTO salon_memberships(salon_id,user_id,role) VALUES ($1,$2,'owner')",[salons[i],users[i]])
      await pool.query("INSERT INTO salon_setup(salon_id,business_type) VALUES ($1,'grooming')",[salons[i]])
    }
    const clients=[]
    for(const salonId of [salons[0],salons[0],salons[1]])clients.push(Number((await pool.query("INSERT INTO clients(salon_id,name,is_occasional) VALUES ($1,'Pet owner',true) RETURNING id",[salonId])).rows[0].id))
    await run({salonId:salons[0],userId:users[0],clientId:clients[0],otherClientId:clients[1],foreignSalonId:salons[1],foreignUserId:users[1],foreignClientId:clients[2]})
  }finally{
    for(const id of salons)await pool.query('DELETE FROM salons WHERE id=$1',[id])
    for(const id of users)await pool.query('DELETE FROM users WHERE id=$1',[id])
  }
}
const create=(f,body=draft())=>createClientPet({...f,body})
const edit=(f,p,body={})=>updateClientPet({...f,petId:p.id,body:draft({expected_revision:p.revision,...body})})
const active=(f,p,value)=>setClientPetActive({...f,petId:p.id,body:{active:value,expected_revision:p.revision}})
test('pets DB: multiple pets and equal names have independent identities',()=>fixture(async f=>{
  const a=await create(f),b=await create(f,draft({species:'cat',breed:''}))
  assert.notEqual(a.id,b.id);assert.equal(a.revision,1);assert.equal(a.active,true)
  assert.equal((await getClientPets(f)).length,2)
  assert.equal((await getClientPets({...f,clientId:f.otherClientId})).length,0)
  assert.equal(Number(a.salon_id),f.salonId);assert.equal(Number(a.client_id),f.clientId)
}))
test('pets DB: edit archive reactivate and no-op preserve identity',()=>fixture(async f=>{
  const a=await create(f),b=await edit(f,a,{name:'Luna II'})
  assert.equal(b.revision,2);assert.equal(b.id,a.id);assert.equal(b.name,'Luna II')
  const c=await active(f,b,false);assert.equal(c.active,false);assert.equal(c.revision,3)
  assert.equal((await active(f,c,false)).revision,3)
  assert.equal((await getClientPets(f))[0].active,false)
  const d=await active(f,c,true);assert.equal(d.active,true);assert.equal(d.revision,4)
}))
test('pets DB: stale edits and stale status cannot overwrite',()=>fixture(async f=>{
  const a=await create(f);await edit(f,a,{name:'New'})
  await assert.rejects(edit(f,a,{name:'Old'}),{code:'PET_VERSION_CONFLICT'})
  await assert.rejects(active(f,a,false),{code:'PET_VERSION_CONFLICT'})
  assert.equal((await getClientPets(f))[0].name,'New')
}))
test('pets DB: concurrent updates have exactly one winner',()=>fixture(async f=>{
  const a=await create(f)
  const results=await Promise.allSettled([edit(f,a,{name:'A'}),edit(f,a,{name:'B'})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'PET_VERSION_CONFLICT')
}))
test('pets DB: wrong owner and foreign salon cannot read or mutate',()=>fixture(async f=>{
  const a=await create(f)
  await assert.rejects(getClientPets({...f,clientId:f.foreignClientId}),{code:'CLIENT_NOT_FOUND'})
  await assert.rejects(create({...f,clientId:f.foreignClientId}),{code:'CLIENT_NOT_FOUND'})
  await assert.rejects(edit({...f,clientId:f.otherClientId},a),{code:'PET_NOT_FOUND'})
  await assert.rejects(active({...f,clientId:f.otherClientId},a,false),{code:'PET_NOT_FOUND'})
  await assert.rejects(getClientPets({...f,salonId:f.foreignSalonId,clientId:f.foreignClientId}),{code:'PET_FORBIDDEN'})
  const foreign={...f,salonId:f.foreignSalonId,userId:f.foreignUserId,clientId:f.foreignClientId}
  await assert.rejects(edit(foreign,a),{code:'PET_NOT_FOUND'})
  assert.equal((await getClientPets(f))[0].revision,1)
}))
test('pets DB: archived client allows read/archive but not create/edit/reactivate',()=>fixture(async f=>{
  const a=await create(f)
  await pool.query('UPDATE clients SET active=false WHERE id=$1',[f.clientId])
  assert.equal((await getClientPets(f)).length,1)
  await assert.rejects(create(f),{code:'PET_CLIENT_ARCHIVED'})
  await assert.rejects(edit(f,a),{code:'PET_CLIENT_ARCHIVED'})
  const archived=await active(f,a,false)
  await assert.rejects(active(f,archived,true),{code:'PET_CLIENT_ARCHIVED'})
  await pool.query('UPDATE clients SET active=true WHERE id=$1',[f.clientId])
  assert.equal((await active(f,archived,true)).active,true)
}))
test('pets DB: authoritative role active user membership and salon are checked',()=>fixture(async f=>{
  await pool.query("UPDATE salon_memberships SET role='admin' WHERE salon_id=$1",[f.salonId])
  await create(f)
  for(const [bad,restore,id] of [
    ["WITH test_employee AS (INSERT INTO employees(salon_id,name) VALUES ($1,'Pets permission test') RETURNING id) UPDATE salon_memberships SET role='employee', employee_id=(SELECT id FROM test_employee) WHERE salon_id=$1","UPDATE salon_memberships SET role='admin' WHERE salon_id=$1",f.salonId],
    ['UPDATE salon_memberships SET active=false WHERE salon_id=$1','UPDATE salon_memberships SET active=true WHERE salon_id=$1',f.salonId],
    ['UPDATE users SET active=false WHERE id=$1','UPDATE users SET active=true WHERE id=$1',f.userId],
    ['UPDATE salons SET active=false WHERE id=$1','UPDATE salons SET active=true WHERE id=$1',f.salonId]
  ]){
    await pool.query(bad,[id]);await assert.rejects(create(f),{code:'PET_FORBIDDEN'});await assert.rejects(getClientPets(f),{code:'PET_FORBIDDEN'});await pool.query(restore,[id])
  }
}))
test('pets DB: business gate handles hair other missing setup and mixed',()=>fixture(async f=>{
  for(const business of ['hair','other',null]){
    await pool.query('UPDATE salon_setup SET business_type=$2 WHERE salon_id=$1',[f.salonId,business])
    await assert.rejects(create(f),{code:'PET_BUSINESS_DISABLED'})
  }
  await pool.query("UPDATE salon_setup SET business_type='mixed' WHERE salon_id=$1",[f.salonId]);await create(f)
  await pool.query('DELETE FROM salon_setup WHERE salon_id=$1',[f.salonId])
  await assert.rejects(getClientPets(f),{code:'PET_BUSINESS_DISABLED'})
  assert.equal(Number((await pool.query('SELECT count(*) FROM client_pets WHERE salon_id=$1',[f.salonId])).rows[0].count),1)
}))
test('pets DB: composite FK prevents cross-tenant owner, constraints reject invalid records',()=>fixture(async f=>{
  await assert.rejects(pool.query("INSERT INTO client_pets(salon_id,client_id,name,species) VALUES ($1,$2,'Luna','dog')",[f.salonId,f.foreignClientId]),{code:'23503'})
  const a=await create(f)
  for(const [column,value] of [['name',' '],['species','invalid'],['revision',0]])await assert.rejects(pool.query(`UPDATE client_pets SET ${column}=$2 WHERE id=$1`,[a.id,value]),{code:'23514'})
  await assert.rejects(pool.query('UPDATE client_pets SET breed=$2 WHERE id=$1',[a.id,'x'.repeat(151)]),{code:'22001'})
}))
test('pets DB: archive does not delete clients or appointments',()=>fixture(async f=>{
  const before=(await pool.query('SELECT count(*)::int AS n FROM appointments WHERE salon_id=$1',[f.salonId])).rows[0].n
  await active(f,await create(f),false)
  assert.equal((await pool.query('SELECT active FROM clients WHERE id=$1',[f.clientId])).rows[0].active,true)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM appointments WHERE salon_id=$1',[f.salonId])).rows[0].n,before)
}))
test('pets API DB: lifecycle response no-store and selected tenant, malformed and foreign IDs',()=>fixture(async f=>{
  const app=createFixedTenantTestApp(f.salonId,{userId:f.userId})
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
  const base=`http://127.0.0.1:${server.address().port}/api/clients/${f.clientId}/pets`
  const send=(url,method,body)=>fetch(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  try{
    let r=await send(base,'POST',draft());assert.equal(r.status,201);assert.equal(r.headers.get('cache-control'),'no-store')
    const p=(await r.json()).data;assert.equal(Number(p.salon_id),f.salonId)
    r=await fetch(base);assert.equal(r.status,200);assert.equal((await r.json()).data.length,1)
    r=await send(base+'/'+p.id,'PUT',draft({name:'Rex',expected_revision:1}));assert.equal(r.status,200)
    r=await send(base+'/'+p.id+'/active','PATCH',{active:false,expected_revision:2});assert.equal(r.status,200);assert.equal((await r.json()).data.active,false)
    r=await send(base,'POST',draft({salon_id:f.foreignSalonId}));assert.equal(r.status,400)
    r=await fetch(base.replace('/'+f.clientId+'/pets','/'+f.foreignClientId+'/pets'));assert.equal(r.status,404)
    r=await send(base+'/'+p.id+'/active','PATCH',{active:true,expected_revision:1});assert.equal(r.status,409)
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}))
