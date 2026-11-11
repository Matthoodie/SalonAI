import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {prepareAppointmentCreation} from '../src/services/appointmentService.js'
import {getPetHistory} from '../src/services/petHistoryService.js'
import {createFixedTenantTestApp} from './helpers/fixedTenantTestApp.js'
after(()=>pool.end())
async function fixture(run) {
  const salons=[],users=[]
  try {
    const sid=async()=>{const id=Number((await pool.query("INSERT INTO salons(name,timezone) VALUES ('Recipient test','Europe/Zagreb') RETURNING id")).rows[0].id);salons.push(id);return id}
    const salonId=await sid(),foreignSalonId=await sid()
    const uid=async()=>{const token=randomUUID();const id=Number((await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id",['recipient_'+token,token+'@example.test'])).rows[0].id);users.push(id);return id}
    const userId=await uid(),employeeUserId=await uid()
    const employee=async name=>Number((await pool.query('INSERT INTO employees(salon_id,name) VALUES ($1,$2) RETURNING id',[salonId,name])).rows[0].id)
    const employeeId=await employee('Groomer'),coworkerId=await employee('Other groomer')
    await pool.query("INSERT INTO salon_memberships(salon_id,user_id,role) VALUES ($1,$2,'owner')",[salonId,userId])
    await pool.query("INSERT INTO salon_memberships(salon_id,user_id,role,employee_id) VALUES ($1,$2,'employee',$3)",[salonId,employeeUserId,employeeId])
    await pool.query("INSERT INTO salon_setup(salon_id,business_type) VALUES ($1,'grooming')",[salonId])
    const owner=async id=>Number((await pool.query("INSERT INTO clients(salon_id,name,is_occasional) VALUES ($1,'Owner',true) RETURNING id",[id])).rows[0].id)
    const clientId=await owner(salonId),otherClientId=await owner(salonId),foreignClientId=await owner(foreignSalonId)
    const pet=async(sid,cid,name='Siri')=>Number((await pool.query("INSERT INTO client_pets(salon_id,client_id,name,species,breed,notes) VALUES ($1,$2,$3,'dog','Ptičar','Private note') RETURNING id",[sid,cid,name])).rows[0].id)
    const petId=await pet(salonId,clientId),secondPetId=await pet(salonId,clientId),otherPetId=await pet(salonId,otherClientId),foreignPetId=await pet(foreignSalonId,foreignClientId)
    const services=[]
    for(const name of ['Wash','Cut'])services.push(Number((await pool.query("INSERT INTO services(salon_id,name,category,price_cents,default_duration_minutes) VALUES ($1,$2,'Grooming',1000,20) RETURNING id",[salonId,name])).rows[0].id))
    for(const eid of [employeeId,coworkerId]) {
      await pool.query('INSERT INTO employee_services(employee_id,service_id,salon_id) SELECT $1,unnest($2::bigint[]),$3',[eid,services,salonId])
      await pool.query("INSERT INTO employee_working_hours(employee_id,day_of_week,start_time,end_time) SELECT $1,d,'08:00'::time,'18:00'::time FROM generate_series(1,7) d",[eid])
    }
    const input={salon_id:salonId,client_id:clientId,employee_id:employeeId,service_ids:services,starts_at:'2030-01-09T09:00:00Z',recipient_type:'pet',pet_id:petId}
    await run({salonId,foreignSalonId,userId,employeeUserId,employeeId,coworkerId,clientId,otherClientId,foreignClientId,petId,secondPetId,otherPetId,foreignPetId,services,input})
  } finally {
    for(const id of salons)await pool.query('DELETE FROM appointments WHERE salon_id=$1',[id])
    for(const id of salons)await pool.query('DELETE FROM salons WHERE id=$1',[id])
    for(const id of users)await pool.query('DELETE FROM users WHERE id=$1',[id])
  }
}
async function create(input) {const r=await prepareAppointmentCreation(input);assert.equal(r.error,undefined,JSON.stringify(r.error));return r.data}

test('pet history DB: same-name pets and unclassified appointments are separate',()=>fixture(async f=>{
  const a=await create(f.input)
  await create({...f.input,pet_id:f.secondPetId,employee_id:f.coworkerId})
  const old=await create({...f.input,starts_at:'2030-01-10T09:00:00Z'})
  await pool.query('UPDATE appointments SET recipient_type=NULL,pet_id=NULL,pet_name=NULL,pet_species=NULL,pet_breed=NULL WHERE id=$1',[old.id])
  const result=await getPetHistory(f)
  assert.deepEqual(result.appointments.map(a=>a.id),[a.id]);assert.equal(result.timezone,'Europe/Zagreb')
  assert.equal(result.next_cursor,null)
}))
test('pet history DB: service and pet snapshots survive rename, archive and status changes',()=>fixture(async f=>{
  const a=await create(f.input)
  await pool.query("UPDATE appointments SET status='completed' WHERE id=$1",[a.id])
  await pool.query("UPDATE client_pets SET name='Novo ime',active=false WHERE id=$1",[f.petId])
  await pool.query('UPDATE clients SET active=false WHERE id=$1',[f.clientId])
  await pool.query("UPDATE services SET name='Nova usluga',price_cents=9000 WHERE salon_id=$1",[f.salonId])
  const row=(await getPetHistory(f)).appointments[0]
  assert.equal(row.pet_name,'Siri');assert.equal(row.status,'completed')
  assert.deepEqual(row.items.map(item=>item.name),['Wash','Cut']);assert.equal(row.price_cents,2000);assert.equal(row.duration_minutes,40)
  assert.equal(Object.hasOwn(row,'notes'),false);assert.equal(Object.hasOwn(row,'photo_data'),false)
}))
test('pet history DB: owner, salon, role and active membership enforced on every page',()=>fixture(async f=>{
  await create(f.input)
  for(const [context,code] of [[{...f,clientId:f.otherClientId},'PET_NOT_FOUND'],[{...f,petId:f.foreignPetId},'PET_NOT_FOUND'],
    [{...f,salonId:f.foreignSalonId},'PET_FORBIDDEN'],[{...f,userId:f.employeeUserId},'PET_FORBIDDEN']])await assert.rejects(getPetHistory(context),{code})
  await pool.query('UPDATE salon_memberships SET active=false WHERE salon_id=$1 AND user_id=$2',[f.salonId,f.userId])
  await assert.rejects(getPetHistory(f),{code:'PET_FORBIDDEN'})
}))
test('pet history DB: pagination keeps 23 cancelled appointments with equal start and microseconds',()=>fixture(async f=>{
  const ids=[]
  for(let i=0;i<23;i++){
    const a=await create(f.input);ids.push(a.id)
    await pool.query("UPDATE appointments SET status='cancelled',starts_at=starts_at+interval '123456 microseconds',ends_at=ends_at+interval '123456 microseconds' WHERE id=$1",[a.id])
  }
  const first=await getPetHistory(f),second=await getPetHistory(f,{cursor:first.next_cursor})
  assert.equal(first.appointments.length,20);assert.equal(second.appointments.length,3);assert.equal(second.next_cursor,null)
  assert.deepEqual([...first.appointments,...second.appointments].map(a=>a.id),ids.reverse())
  await assert.rejects(getPetHistory({...f,petId:f.secondPetId},{cursor:first.next_cursor}),{code:'PET_HISTORY_INVALID_CURSOR'})
}))
test('pet history API DB: no-store, owner read and employee denial',()=>fixture(async f=>{
  await create(f.input)
  for(const role of ['owner','employee']){
    const app=createFixedTenantTestApp(f.salonId,{role,employeeId:f.employeeId,userId:role==='owner'?f.userId:f.employeeUserId})
    const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
    try{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/clients/${f.clientId}/pets/${f.petId}/appointments`)
      assert.equal(response.status,role==='owner'?200:403)
      if(role==='owner'){assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).data.appointments.length,1)}
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  }
}))
