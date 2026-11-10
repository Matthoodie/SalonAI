import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/database/pool.js'
import {changeAppointmentRecipient,changeLegacyAppointmentClient,getBookingPetOptions} from '../src/services/appointmentRecipientService.js'
after(()=>pool.end())
const base={id:'10',salon_id:'1',client_id:'2',employee_id:'4',recipient_type:null,pet_id:null,pet_name:null,pet_species:null,pet_breed:null,recipient_revision:1,status:'confirmed'}
const input={salonId:1,appointmentId:10,body:{client_id:2,recipient_type:'pet',pet_id:3,expected_recipient_revision:1}}
async function connection(run,{row=base,failCommit=false,failUpdate=false}={}) {
  const original=pool.connect;const calls=[];let released=false,updates=0
  pool.connect=async()=>({release:()=>{released=true},query:async(sql,args)=>{
    calls.push({sql,args})
    if(sql==='COMMIT'&&failCommit)throw Error('Uncertain commit')
    if(sql.includes('UPDATE appointments')){updates++;if(failUpdate)throw Error('write failed');return {rows:[]}}
    if(sql.includes('FROM appointments'))return {rows:row?[row]:[]}
    if(sql.includes('FROM salon_setup'))return {rows:[{business_type:'grooming'}]}
    if(sql.includes('FROM client_pets'))return {rows:[{id:'3',name:'Siri',species:'dog',breed:'Ptičar',active:true}]}
    if(sql.includes('FROM clients'))return {rows:[{id:2,active:true}]}
    return {rows:[]}
  }})
  try { await run(calls,()=>({released,updates})) } finally {pool.connect=original}
}
test('recipient transaction: owner/pet snapshot update is one transaction and one write',()=>connection(async(calls,state)=>{
  await changeAppointmentRecipient(input)
  assert.equal(calls[0].sql,'BEGIN');assert.equal(calls.at(-1).sql,'COMMIT');assert.equal(state().updates,1);assert.equal(state().released,true)
  const update=calls.find(c=>c.sql.includes('UPDATE appointments'))
  assert.deepEqual(update.args,[10,1,2,'pet',3,'Siri','dog','Ptičar'])
  assert.ok(calls.findIndex(c=>c.sql.includes('FROM employees'))<calls.findIndex(c=>c.sql.includes('FOR UPDATE')&&c.sql.includes('FROM appointments')))
}))
test('recipient transaction: stale revision rolls back before pet lookup',()=>connection(async(calls,state)=>{
  await assert.rejects(changeAppointmentRecipient({...input,body:{...input.body,expected_recipient_revision:2}}),{code:'APPOINTMENT_RECIPIENT_CONFLICT'})
  assert.equal(calls.at(-1).sql,'ROLLBACK');assert.equal(state().updates,0)
  assert.equal(calls.some(c=>c.sql.includes('FROM client_pets')),false)
}))
test('recipient transaction: resolved appointments cannot be reassigned',()=>connection(async(calls,state)=>{
  await assert.rejects(changeAppointmentRecipient(input),{code:'APPOINTMENT_CLIENT_CHANGE_NOT_ALLOWED'})
  assert.equal(state().updates,0);assert.equal(calls.at(-1).sql,'ROLLBACK')
},{row:{...base,status:'completed'}}))
test('recipient transaction: foreign/missing appointment fails before recipient reads',()=>connection(async(calls,state)=>{
  await assert.rejects(changeAppointmentRecipient(input),{code:'APPOINTMENT_NOT_FOUND'})
  assert.equal(state().updates,0);assert.equal(calls.some(c=>c.sql.includes('FROM clients')),false)
},{row:null}))
test('recipient transaction: employee scope is supplied to both reads',()=>connection(async(calls)=>{
  await changeAppointmentRecipient({...input,employeeScope:4})
  for(const c of calls.filter(c=>c.sql.includes('FROM appointments'))) assert.equal(c.args[2],4)
}))
test('recipient transaction: no-op keeps original labels and permits archived unchanged pet',()=>connection(async(calls,state)=>{
  const r=await changeAppointmentRecipient(input)
  assert.equal(r.pet_name,'Original');assert.equal(state().updates,0)
  assert.equal(calls.some(c=>c.sql.includes('FROM client_pets')),false)
},{row:{...base,recipient_type:'pet',pet_id:'3',pet_name:'Original'}}))
test('recipient transaction: legacy endpoint cannot detach or transfer linked pet',()=>connection(async(calls,state)=>{
  await assert.rejects(changeLegacyAppointmentClient(10,1,9),{code:'APPOINTMENT_RECIPIENT_UPDATE_REQUIRED'})
  assert.equal(state().updates,0);assert.equal(calls.at(-1).sql,'ROLLBACK')
},{row:{...base,recipient_type:'pet',pet_id:'3'}}))
test('recipient transaction: failed write rolls back, releases, never retries',()=>connection(async(calls,state)=>{
  await assert.rejects(changeAppointmentRecipient(input),/write failed/)
  assert.deepEqual(state(),{released:true,updates:1});assert.equal(calls.at(-1).sql,'ROLLBACK');assert.equal(calls.some(c=>c.sql==='COMMIT'),false)
},{failUpdate:true}))
test('recipient transaction: uncertain commit propagates without replay',()=>connection(async(calls,state)=>{
  await assert.rejects(changeAppointmentRecipient(input),/Uncertain commit/)
  assert.deepEqual(state(),{released:true,updates:1});assert.equal(calls.at(-1).sql,'ROLLBACK')
},{failCommit:true}))
test('booking pet options: paginated allowlisted projection, never profiles or contacts',async()=>{
  const original=pool.query,calls=[]
  pool.query=async(sql,args)=>{
    calls.push({sql,args})
    if(sql.includes('FROM salon_setup'))return {rows:[{business_type:'grooming'}]}
    if(sql.includes('FROM clients'))return {rows:[{id:'2',active:true}]}
    return {rows:Array.from({length:51},(_,i)=>({id:String(i+1),salon_id:'1',client_id:'2',name:'Siri',species:'dog',breed:''}))}
  }
  try {
    const r=await getBookingPetOptions({salonId:1,clientId:2})
    assert.equal(r.pets.length,50);assert.equal(r.next_cursor,'50')
    assert.match(calls.at(-1).sql,/active AND id>\$3/);assert.doesNotMatch(calls.at(-1).sql,/notes|phone|email/)
    assert.deepEqual(calls.at(-1).args,[1,2,0])
  } finally {pool.query=original}
})
