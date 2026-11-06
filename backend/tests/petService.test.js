import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/database/pool.js'
import {createClientPet,getClientPets} from '../src/services/petService.js'
after(()=>pool.end())
const context={salonId:1,userId:2,clientId:3}
const body={name:'Luna',species:'dog',breed:'',notes:''}
async function mockConnection(run,query){
  const original=pool.connect,commands=[];let released=false
  pool.connect=async()=>({query:async(sql,args)=>{commands.push(sql);return query(sql,args)},release:()=>{released=true}})
  try{await run(commands,()=>released)}finally{pool.connect=original}
}
test('pets transaction: failed insert rolls back and releases, never commits',async()=>{
  const failure=new Error('simulated insert failure')
  await mockConnection(async(commands,released)=>{
    await assert.rejects(createClientPet({...context,body}),e=>e===failure)
    assert.equal(commands[0],'BEGIN');assert.equal(commands.at(-1),'ROLLBACK')
    assert.equal(commands.includes('COMMIT'),false);assert.equal(released(),true)
  },async sql=>{
    if(sql.includes('INSERT INTO client_pets'))throw failure
    if(sql.includes('FROM salon_setup'))return {rows:[{business_type:'grooming'}]}
    return {rows:[{id:3,active:true}]}
  })
})
test('pets transaction: revoked membership stops before client or pet lookup',async()=>{
  await mockConnection(async(commands,released)=>{
    await assert.rejects(getClientPets(context),{code:'PET_FORBIDDEN'})
    assert.equal(commands.some(s=>s.includes('FROM clients')||s.includes('FROM client_pets')),false)
    assert.equal(commands.at(-1),'ROLLBACK');assert.equal(released(),true)
  },async()=>({rows:[]}))
})
test('pets transaction: commit failure is surfaced, no retry of creation',async()=>{
  let inserts=0
  await mockConnection(async(commands,released)=>{
    await assert.rejects(createClientPet({...context,body}),/commit failed/)
    assert.equal(inserts,1);assert.equal(commands.at(-1),'ROLLBACK');assert.equal(released(),true)
  },async sql=>{
    if(sql==='COMMIT')throw Error('commit failed')
    if(sql.includes('INSERT INTO client_pets'))inserts++
    if(sql.includes('FROM salon_setup'))return {rows:[{business_type:'grooming'}]}
    return {rows:[{id:3,active:true}]}
  })
})
