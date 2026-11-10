import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/database/pool.js'
import {createFixedTenantTestApp} from './helpers/fixedTenantTestApp.js'
after(()=>pool.end())
async function withApi(role,run,{deny=false}={}) {
  const original=pool.query,commands=[]
  pool.query=async(sql,args)=>{
    commands.push({sql,args})
    if(sql.includes('salon_permission_overrides'))return {rows:deny?[{permission_value:'deny'}]:[]}
    if(sql.includes('FROM salon_setup'))return {rows:[{business_type:'grooming'}]}
    if(sql.includes('FROM clients'))return {rows:[{id:'2',active:true}]}
    if(sql.includes('FROM client_pets'))return {rows:[{id:'3',salon_id:'1',client_id:'2',name:'Siri',species:'dog',breed:'Ptičar'}]}
    if(sql.includes('FROM appointments'))return {rows:[]}
    throw Error('Unexpected SQL in API test')
  }
  const app=createFixedTenantTestApp(1,{role,employeeId:4,userId:5})
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
  const send=async(path,method='GET',body)=>{
    const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()}
  }
  try {await run(send,commands)} finally {pool.query=original;server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
test('recipient HTTP: owner lookup route precedes /:id and returns scoped no-store data',()=>withApi('owner',async(send,calls)=>{
  const r=await send('/appointments/pet-options?client_id=2')
  assert.equal(r.status,200);assert.equal(r.cache,'no-store');assert.equal(r.body.data.pets[0].name,'Siri')
  assert.deepEqual(calls.at(-1).args,[1,2,0])
}))
test('recipient HTTP: employee create permission permits minimal options but not pet CRUD',()=>withApi('employee',async send=>{
  assert.equal((await send('/appointments/pet-options?client_id=2')).status,200)
  assert.equal((await send('/clients/2/pets')).status,403)
}))
test('recipient HTTP: denied employee cannot enumerate pets or update recipient',()=>withApi('employee',async(send,calls)=>{
  assert.equal((await send('/appointments/pet-options?client_id=2')).status,403)
  assert.equal((await send('/appointments/10/recipient','PATCH',{client_id:2,recipient_type:'pet',pet_id:3,expected_recipient_revision:1})).status,403)
  assert.equal(calls.some(c=>c.sql.includes('FROM client_pets')),false)
},{deny:true}))
test('recipient HTTP: self scope filters coworker appointment before options query',()=>withApi('employee',async(send,calls)=>{
  // Employee default change_client is deny. Grant self with a narrowly overridden query.
  const actual=pool.query
  pool.query=async(sql,args)=>sql.includes('salon_permission_overrides')?{rows:[{permission_value:'self'}]}:actual(sql,args)
  const r=await send('/appointments/pet-options?client_id=2&appointment_id=10')
  assert.equal(r.status,404);assert.equal(calls.some(c=>c.sql.includes('FROM client_pets')),false)
  assert.deepEqual(calls.find(c=>c.sql.includes('FROM appointments')).args,[10,1,4])
}))
test('recipient HTTP: malformed recipient/query fails before database access',()=>withApi('owner',async(send,calls)=>{
  for(const query of ['client_id=0','client_id=01','client_id=2&after=-1','client_id=2&appointment_id=x'])assert.equal((await send('/appointments/pet-options?'+query)).status,400)
  const r=await send('/appointments','POST',{client_id:2,employee_id:4,service_ids:[1],starts_at:'2030-01-09T09:00:00Z',recipient_type:'pet',pet_id:true})
  assert.equal(r.status,400);assert.equal(calls.length,0)
  assert.equal((await send('/appointments/10/recipient','PATCH',{client_id:2,recipient_type:'pet',pet_id:3,expected_recipient_revision:1,pet_name:'Injected'})).status,400)
  assert.equal(calls.length,0)
}))
