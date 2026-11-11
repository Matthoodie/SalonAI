import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {getClientPets,createClientPet,updateClientPet,setClientPetActive} from '../src/services/petService.js'
import sharp from 'sharp'
import {createPetPhotoService} from '../src/services/petPhotoService.js'
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
const service=createPetPhotoService()
const jpg=()=>sharp({create:{width:20,height:30,channels:3,background:'#663399'}}).jpeg().toBuffer()
const create=f=>createClientPet({...f,body:draft()})
const upload=async(f,p)=>service.upload({...f,petId:p.id},await jpg(),p.revision)
test('photo DB: upload, replace, binary read, metadata-only list, delete preserve profile',()=>fixture(async f=>{
  const p=await create(f);assert.equal(p.has_photo,false);assert.equal(p.photo_version,0)
  const a=await upload(f,p);assert.equal(a.has_photo,true);assert.equal(a.photo_version,1);assert.equal(a.revision,2)
  const read=await service.read({...f,petId:p.id},1);assert.equal((await sharp(read.bytes).metadata()).format,'jpeg')
  const list=await getClientPets(f);assert.equal(list[0].has_photo,true);assert.equal(Object.hasOwn(list[0],'photo_data'),false)
  const b=await upload(f,a);assert.equal(b.photo_version,2);assert.equal(b.revision,3)
  await assert.rejects(service.read({...f,petId:p.id},1),{code:'PET_PHOTO_CHANGED'})
  const c=await service.remove({...f,petId:p.id},b.revision);assert.equal(c.has_photo,false);assert.equal(c.photo_version,3);assert.equal(c.revision,4)
  assert.equal(c.name,p.name);assert.equal(c.notes,p.notes);assert.equal(c.active,true)
  await assert.rejects(service.read({...f,petId:p.id},3),{code:'PET_PHOTO_NOT_FOUND'})
  assert.equal((await service.remove({...f,petId:p.id},4)).revision,4)
  const row=(await pool.query('SELECT photo_data,photo_width,photo_height FROM client_pets WHERE id=$1',[p.id])).rows[0]
  assert.deepEqual(row,{photo_data:null,photo_width:null,photo_height:null})
}))
test('photo DB: another owner or tenant cannot read or mutate photo',()=>fixture(async f=>{
  const p=await upload(f,await create(f))
  for(const [context,code] of [
    [{...f,clientId:f.otherClientId},'PET_NOT_FOUND'],
    [{...f,clientId:f.foreignClientId},'CLIENT_NOT_FOUND'],
    [{...f,salonId:f.foreignSalonId,clientId:f.foreignClientId},'PET_FORBIDDEN'],
    [{...f,salonId:f.foreignSalonId,userId:f.foreignUserId,clientId:f.foreignClientId},'PET_NOT_FOUND'],
  ]){
    await assert.rejects(service.read({...context,petId:p.id},1),{code})
    await assert.rejects(upload(context,p),{code})
    await assert.rejects(service.remove({...context,petId:p.id},p.revision),{code})
  }
  assert.equal((await getClientPets(f))[0].photo_version,1)
}))
test('photo DB: archive preserves photo for review/removal but prevents replacement',()=>fixture(async f=>{
  let p=await upload(f,await create(f))
  p=await setClientPetActive({...f,petId:p.id,body:{active:false,expected_revision:p.revision}})
  await assert.rejects(upload(f,p),{code:'PET_PHOTO_ARCHIVED'})
  assert.ok((await service.read({...f,petId:p.id},1)).bytes.length)
  await pool.query('UPDATE clients SET active=false WHERE id=$1',[f.clientId])
  await assert.rejects(upload(f,p),{code:'PET_CLIENT_ARCHIVED'})
  p=await service.remove({...f,petId:p.id},p.revision);assert.equal(p.has_photo,false);assert.equal(p.active,false)
}))
test('photo DB: concurrent upload/delete have one winner, stale edit cannot overwrite',()=>fixture(async f=>{
  const p=await upload(f,await create(f))
  const result=await Promise.allSettled([upload(f,p),service.remove({...f,petId:p.id},p.revision)])
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(result.find(r=>r.status==='rejected').reason.code,'PET_VERSION_CONFLICT')
  await assert.rejects(updateClientPet({...f,petId:p.id,body:draft({expected_revision:p.revision})}),{code:'PET_VERSION_CONFLICT'})
  assert.equal((await getClientPets(f))[0].revision,p.revision+1)
}))
test('photo DB: permission revoked during decoding prevents write',()=>fixture(async f=>{
  const p=await create(f)
  const delayed=createPetPhotoService({processImage:async()=>{
    await pool.query('UPDATE salon_memberships SET active=false WHERE salon_id=$1',[f.salonId])
    return {bytes:await jpg(),width:20,height:30}
  }})
  await assert.rejects(delayed.upload({...f,petId:p.id},await jpg(),p.revision),{code:'PET_FORBIDDEN'})
  const row=(await pool.query('SELECT revision,photo_data FROM client_pets WHERE id=$1',[p.id])).rows[0]
  assert.equal(row.revision,1);assert.equal(row.photo_data,null)
}))
test('photo DB: malformed image leaves existing photo unchanged',()=>fixture(async f=>{
  const p=await upload(f,await create(f)),before=(await service.read({...f,petId:p.id},1)).bytes
  await assert.rejects(service.upload({...f,petId:p.id},Buffer.from([255,216,255,0]),p.revision),{code:'PET_PHOTO_INVALID'})
  assert.deepEqual((await service.read({...f,petId:p.id},1)).bytes,before)
  assert.equal((await getClientPets(f))[0].revision,p.revision)
}))
test('photo DB: database constraints reject incomplete, oversized and non-JPEG storage',()=>fixture(async f=>{
  const p=await create(f)
  for(const [sql,values] of [
    ['UPDATE client_pets SET photo_width=5 WHERE id=$1',[p.id]],
    ['UPDATE client_pets SET photo_data=$2,photo_width=5,photo_height=5,photo_version=1 WHERE id=$1',[p.id,Buffer.from('bad!')]],
    ['UPDATE client_pets SET photo_data=$2,photo_width=5,photo_height=5,photo_version=1 WHERE id=$1',[p.id,Buffer.alloc(524289,255)]],
    ['UPDATE client_pets SET photo_version=-1 WHERE id=$1',[p.id]],
  ])await assert.rejects(pool.query(sql,values),{code:'23514'})
}))
test('photo API DB: authorized binary lifecycle and employee denial',()=>fixture(async f=>{
  const p=await create(f),app=createFixedTenantTestApp(f.salonId,{userId:f.userId})
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
  const url=`http://127.0.0.1:${server.address().port}/api/clients/${f.clientId}/pets/${p.id}/photo`
  try{
    let response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/octet-stream','If-Match':'"1"'},body:await jpg()})
    assert.equal(response.status,200);assert.equal((await response.json()).data.has_photo,true)
    response=await fetch(url+'?version=1');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/)
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width,20)
    response=await fetch(url,{method:'DELETE',headers:{'If-Match':'"2"'}});assert.equal(response.status,200)
    assert.equal((await response.json()).data.has_photo,false)
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  await pool.query('UPDATE salon_memberships SET active=false WHERE salon_id=$1',[f.salonId])
  await assert.rejects(service.read({...f,petId:p.id},1),{code:'PET_FORBIDDEN'})
}))
