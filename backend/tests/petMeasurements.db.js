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

test('measurements DB: create, partial legacy update, explicit clear and archive preserve profile',()=>fixture(async f=>{
  let p=await create(f,draft({size_category:'medium',weight_grams:12500}))
  assert.equal(p.size_category,'medium');assert.equal(p.weight_grams,12500)
  p=await edit(f,p,{name:'Luna II'});assert.equal(p.weight_grams,12500);assert.equal(p.size_category,'medium')
  p=await edit(f,p,{weight_grams:1});assert.equal(p.weight_grams,1);assert.equal(p.size_category,'medium')
  p=await active(f,p,false);assert.equal(p.weight_grams,1)
  p=await active(f,p,true)
  p=await edit(f,p,{weight_grams:null,size_category:null});assert.equal(p.weight_grams,null);assert.equal(p.size_category,null)
  const old=await create(f);assert.equal(old.size_category,null);assert.equal(old.weight_grams,null)
}))
test('measurements DB: constraints reject invalid direct writes',()=>fixture(async f=>{
  const p=await create(f)
  for(const [field,value] of [['weight_grams',0],['weight_grams',200001],['size_category','huge']]){
    await assert.rejects(pool.query(`UPDATE client_pets SET ${field}=$2 WHERE id=$1`,[p.id,value]),{code:'23514'})
  }
  await pool.query('UPDATE client_pets SET weight_grams=200000 WHERE id=$1',[p.id])
  assert.equal((await getClientPets(f))[0].weight_grams,200000)
}))
test('measurements DB: competing edits share revision and preserve photo data',()=>fixture(async f=>{
  const p=await create(f,draft({weight_grams:12500}))
  // Minimal valid database fixture; image processing is covered by photo tests.
  await pool.query("UPDATE client_pets SET photo_data=decode('ffd8ff01','hex'),photo_width=1,photo_height=1,photo_version=1 WHERE id=$1",[p.id])
  const results=await Promise.allSettled([edit(f,p,{weight_grams:13000}),edit(f,p,{size_category:'large'})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'PET_VERSION_CONFLICT')
  const saved=(await getClientPets(f))[0];assert.equal(saved.revision,2);assert.equal(saved.has_photo,true);assert.equal(saved.photo_version,1)
  assert.equal((await pool.query('SELECT octet_length(photo_data) AS bytes FROM client_pets WHERE id=$1',[p.id])).rows[0].bytes,4)
}))
test('measurements DB: tenant/owner isolation and archived owner prevent edit',()=>fixture(async f=>{
  const p=await create(f,draft({weight_grams:1000}))
  await assert.rejects(edit({...f,clientId:f.otherClientId},p,{weight_grams:2000}),{code:'PET_NOT_FOUND'})
  await assert.rejects(edit({...f,salonId:f.foreignSalonId},p,{weight_grams:2000}),{code:'PET_FORBIDDEN'})
  await pool.query('UPDATE clients SET active=false WHERE id=$1',[f.clientId])
  await assert.rejects(edit(f,p,{weight_grams:2000}),{code:'PET_CLIENT_ARCHIVED'})
  assert.equal((await getClientPets(f))[0].weight_grams,1000)
}))
test('measurements API DB: owner lifecycle, invalid value rejection and employee denial',()=>fixture(async f=>{
  const p=await create(f)
  for(const role of ['owner','employee']){
    const app=createFixedTenantTestApp(f.salonId,{role,userId:f.userId}),server=app.listen(0)
    await new Promise(resolve=>server.once('listening',resolve))
    try{
      const url=`http://127.0.0.1:${server.address().port}/api/clients/${f.clientId}/pets/${p.id}`
      const send=body=>fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      let response=await send(draft({expected_revision:1,weight_grams:12500,size_category:'medium'}))
      assert.equal(response.status,role==='owner'?200:403)
      if(role==='owner'){
        assert.equal((await response.json()).data.weight_grams,12500)
        response=await send(draft({expected_revision:2,weight_grams:0}));assert.equal(response.status,400)
      }
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  }
}))
