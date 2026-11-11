import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {prepareAppointmentCreation,changeAppointmentClient,rescheduleAppointment,changeAppointmentServices,changeAppointmentStatus} from '../src/services/appointmentService.js'
import {createAppointmentBooking} from '../src/services/appointmentBookingService.js'
import {changeAppointmentRecipient,getBookingPetOptions} from '../src/services/appointmentRecipientService.js'
import {findAppointmentById,findAllAppointments} from '../src/repositories/appointmentRepository.js'
import {getCalendarContext} from '../src/services/calendarService.js'
import {createFixedTenantTestApp} from './helpers/fixedTenantTestApp.js'
import {up,down} from '../migrations/1794333600000_link-appointment-pets.js'
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
const legacy=f=>{const {recipient_type,pet_id,...r}=f.input;return r}
// Simulate a genuine pre-upgrade row; new grooming writes must not create these.
async function createLegacy(f,extra={}) {
  const a=await create({...f.input,...extra})
  await pool.query('UPDATE appointments SET recipient_type=NULL,pet_id=NULL,pet_name=NULL,pet_species=NULL,pet_breed=NULL WHERE id=$1',[a.id])
  return findAppointmentById(a.id,f.salonId)
}
const change=(f,a,extra={})=>changeAppointmentRecipient({salonId:f.salonId,appointmentId:a.id,body:{client_id:f.clientId,recipient_type:'pet',pet_id:f.petId,expected_recipient_revision:a.recipient_revision,...extra}})
async function api(f,role,run) {
  const app=createFixedTenantTestApp(f.salonId,{role,employeeId:f.employeeId,userId:role==='employee'?f.employeeUserId:f.userId})
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
  const request=async(path,method='GET',body)=>{
    const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()}
  }
  try{await run(request)}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
test('recipient DB: creation retains owner and authoritative pet snapshot across list/detail/calendar',()=>fixture(async f=>{
  const a=await create({...f.input,pet_name:'Injected'});assert.equal(a.pet_name,'Siri');assert.equal(a.pet_species,'dog');assert.equal(a.pet_breed,'Ptičar');assert.equal(a.recipient_revision,1)
  assert.equal(Number(a.client_id),f.clientId);assert.equal(Number(a.pet_id),f.petId);assert.equal(a.items.length,2);assert.equal(a.duration_minutes,40)
  const detail=await findAppointmentById(a.id,f.salonId);assert.equal(detail.pet_name,'Siri')
  assert.equal((await findAllAppointments(f.salonId))[0].pet_name,'Siri')
  const calendar=await getCalendarContext({salonId:f.salonId,from:'2030-01-09',to:'2030-01-09'})
  assert.equal(calendar.data.appointments[0].pet_name,'Siri');assert.equal(calendar.data.appointments[0].client.id,f.clientId)
}))
test('recipient DB: existing legacy bookings are not guessed and can be linked',()=>fixture(async f=>{
  const a=await createLegacy(f);assert.equal(a.pet_id,null);assert.equal(a.recipient_type,null);assert.equal(a.recipient_revision,1)
  const b=await change(f,a);assert.equal(Number(b.pet_id),f.petId);assert.equal(b.recipient_revision,2)
}))
test('recipient DB: same-name animals remain distinct bookings and identities',()=>fixture(async f=>{
  const a=await create(f.input),b=await create({...f.input,pet_id:f.secondPetId,employee_id:f.coworkerId})
  assert.equal(a.pet_name,b.pet_name);assert.notEqual(a.pet_id,b.pet_id)
}))
test('recipient DB: foreign pet/wrong owner/archive cannot create appointment',()=>fixture(async f=>{
  for(const pet_id of [f.otherPetId,f.foreignPetId])await assert.rejects(prepareAppointmentCreation({...f.input,pet_id}),{code:'PET_NOT_FOUND'})
  await pool.query('UPDATE client_pets SET active=false WHERE id=$1',[f.petId])
  await assert.rejects(prepareAppointmentCreation(f.input),{code:'PET_INACTIVE'})
  await pool.query('UPDATE client_pets SET active=true WHERE id=$1',[f.petId])
  await pool.query('UPDATE clients SET active=false WHERE id=$1',[f.clientId])
  await assert.rejects(prepareAppointmentCreation(f.input),{code:'CLIENT_INACTIVE'})
  assert.equal((await findAllAppointments(f.salonId)).length,0)
}))
test('recipient DB: grooming/mixed/hair classification is enforced for explicit input',()=>fixture(async f=>{
  await assert.rejects(prepareAppointmentCreation({...f.input,recipient_type:'person',pet_id:null}),{code:'APPOINTMENT_PET_REQUIRED'})
  await pool.query("UPDATE salon_setup SET business_type='hair' WHERE salon_id=$1",[f.salonId])
  await assert.rejects(prepareAppointmentCreation(f.input),{code:'PET_BUSINESS_DISABLED'})
  await pool.query("UPDATE salon_setup SET business_type='mixed' WHERE salon_id=$1",[f.salonId])
  assert.equal((await create({...f.input,recipient_type:'person',pet_id:null})).pet_id,null)
}))
test('recipient DB: snapshots survive pet rename/archive, status, reschedule and service changes',()=>fixture(async f=>{
  const a=await create(f.input)
  await pool.query("UPDATE client_pets SET name='New name',species='cat',breed='New breed',active=false WHERE id=$1",[f.petId])
  const same=await change(f,a);assert.equal(same.pet_name,'Siri');assert.equal(same.recipient_revision,1)
  const moved=await rescheduleAppointment(a.id,f.salonId,'2030-01-09T11:00:00Z');assert.equal(moved.error,undefined);assert.equal(moved.data.pet_name,'Siri')
  const changed=await changeAppointmentServices(a.id,f.salonId,[f.services[0]]);assert.equal(changed.error,undefined);assert.equal(changed.data.pet_name,'Siri')
  const done=await changeAppointmentStatus(a.id,f.salonId,'completed');assert.equal(done.data.pet_name,'Siri')
  await assert.rejects(change(f,done.data,{pet_id:f.secondPetId}),{code:'APPOINTMENT_CLIENT_CHANGE_NOT_ALLOWED'})
}))
test('recipient DB: owner and pet switch atomically, invalid pairs roll back',()=>fixture(async f=>{
  const a=await create(f.input)
  await assert.rejects(change(f,a,{client_id:f.otherClientId}),{code:'PET_NOT_FOUND'})
  const unchanged=await findAppointmentById(a.id,f.salonId);assert.equal(Number(unchanged.client_id),f.clientId);assert.equal(unchanged.recipient_revision,1)
  const b=await change(f,a,{client_id:f.otherClientId,pet_id:f.otherPetId})
  assert.equal(Number(b.client_id),f.otherClientId);assert.equal(Number(b.pet_id),f.otherPetId);assert.equal(b.recipient_revision,2)
  await assert.rejects(change(f,a),{code:'APPOINTMENT_RECIPIENT_CONFLICT'})
}))
test('recipient DB: concurrent edits have exactly one winner',()=>fixture(async f=>{
  const a=await createLegacy(f)
  const r=await Promise.allSettled([change(f,a),change(f,a,{pet_id:f.secondPetId})])
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1)
  assert.equal(r.find(x=>x.status==='rejected').reason.code,'APPOINTMENT_RECIPIENT_CONFLICT')
}))
test('recipient DB: legacy client mutation cannot move a pet and advances version for legacy rows',()=>fixture(async f=>{
  const a=await create(f.input)
  assert.equal((await changeAppointmentClient(a.id,f.salonId,f.otherClientId)).error.code,'APPOINTMENT_RECIPIENT_UPDATE_REQUIRED')
  const b=await createLegacy(f,{starts_at:'2030-01-09T11:00:00Z'})
  const c=await changeAppointmentClient(b.id,f.salonId,f.otherClientId)
  assert.equal(c.error,undefined);assert.equal(c.data.recipient_revision,2)
  await assert.rejects(change(f,b),{code:'APPOINTMENT_RECIPIENT_CONFLICT'})
}))
test('recipient DB: same pet cannot overlap even with a different groomer; boundary allowed',()=>fixture(async f=>{
  await create(f.input)
  const conflict=await prepareAppointmentCreation({...f.input,employee_id:f.coworkerId})
  assert.equal(conflict.error.code,'PET_APPOINTMENT_CONFLICT')
  await create({...f.input,employee_id:f.coworkerId,starts_at:'2030-01-09T09:40:00Z'})
  assert.equal((await findAllAppointments(f.salonId)).length,2)
}))
test('recipient DB: overlap while changing pet rolls back version and pet',()=>fixture(async f=>{
  await create(f.input)
  const b=await create({...f.input,employee_id:f.coworkerId,pet_id:f.secondPetId})
  await assert.rejects(change(f,b),{constraint:'appointments_pet_no_overlap'})
  const read=await findAppointmentById(b.id,f.salonId);assert.equal(Number(read.pet_id),f.secondPetId);assert.equal(read.recipient_revision,1)
}))
test('recipient DB: failed inline owner plus mismatched pet leaves no orphan owner',()=>fixture(async f=>{
  const {client_id,...input}=f.input
  const before=(await pool.query('SELECT count(*)::int n FROM clients WHERE salon_id=$1',[f.salonId])).rows[0].n
  await assert.rejects(createAppointmentBooking({...input,newClient:{name:'New owner',is_occasional:true}}),{code:'PET_NOT_FOUND'})
  assert.equal((await pool.query('SELECT count(*)::int n FROM clients WHERE salon_id=$1',[f.salonId])).rows[0].n,before)
}))
test('recipient DB: composite FK/check reject forged/null metadata and protect referenced pets',()=>fixture(async f=>{
  const a=await create(f.input)
  await assert.rejects(pool.query('UPDATE appointments SET pet_id=$2 WHERE id=$1',[a.id,f.otherPetId]),{constraint:'appointments_pet_owner_salon_fk'})
  for(const assignment of ["recipient_type=NULL","pet_name=NULL","pet_species=NULL","pet_breed=NULL","recipient_type='person'","recipient_revision=0"]) {
    await assert.rejects(pool.query(`UPDATE appointments SET ${assignment} WHERE id=$1`,[a.id]),{code:'23514'})
  }
  await assert.rejects(pool.query('DELETE FROM client_pets WHERE id=$1',[f.petId]),{code:'23503'})
}))
test('recipient DB: migration down/up in rolled-back test transaction preserves legacy bookings',()=>fixture(async f=>{
  const a=await createLegacy(f),db=await pool.connect()
  try {
    await db.query('BEGIN')
    const run=async(fn)=>{let sql;fn({sql:s=>{sql=s}});await db.query(sql)}
    await run(down)
    assert.equal((await db.query('SELECT client_id FROM appointments WHERE id=$1',[a.id])).rows[0].client_id,String(f.clientId))
    await run(up)
    const row=(await db.query('SELECT recipient_type,pet_id,recipient_revision FROM appointments WHERE id=$1',[a.id])).rows[0]
    assert.deepEqual(row,{recipient_type:null,pet_id:null,recipient_revision:1})
  } finally {await db.query('ROLLBACK');db.release()}
}))
test('recipient API DB: create and patch respect tenant, status, CAS and no-store',()=>fixture(async f=>api(f,'owner',async req=>{
  const {salon_id,...body}=f.input
  const a=await req('/appointments','POST',body);assert.equal(a.status,201,JSON.stringify(a.body))
  const id=a.body.data.id
  let r=await req(`/appointments/${id}/recipient`,'PATCH',{client_id:f.clientId,recipient_type:'pet',pet_id:f.secondPetId,expected_recipient_revision:1})
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.cache,'no-store');assert.equal(Number(r.body.data.pet_id),f.secondPetId)
  r=await req(`/appointments/${id}/recipient`,'PATCH',{client_id:f.clientId,recipient_type:'pet',pet_id:f.petId,expected_recipient_revision:1});assert.equal(r.status,409)
  r=await req(`/appointments/${id}/recipient`,'PATCH',{client_id:f.clientId,recipient_type:'pet',pet_id:f.petId,expected_recipient_revision:2,salon_id:f.foreignSalonId});assert.equal(r.status,400)
})))
test('recipient API DB: restricted employee lookup does not grant profile management',()=>fixture(async f=>api(f,'employee',async req=>{
  let r=await req(`/appointments/pet-options?client_id=${f.clientId}`)
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.cache,'no-store')
  assert.equal(r.body.data.pets.length,2);assert.equal(r.body.data.pets[0].notes,undefined)
  r=await req(`/clients/${f.clientId}/pets`);assert.equal(r.status,403)
  r=await req(`/appointments/pet-options?client_id=${f.foreignClientId}`);assert.equal(r.status,404)
  await pool.query("INSERT INTO salon_permission_overrides(salon_id,role,permission_key,permission_value) VALUES ($1,'employee','appointment.create','deny')",[f.salonId])
  r=await req(`/appointments/pet-options?client_id=${f.clientId}`);assert.equal(r.status,403)
})))
test('recipient API DB: self employee cannot edit/read recipient options for coworker appointment',()=>fixture(async f=>{
  const a=await create({...f.input,employee_id:f.coworkerId})
  await pool.query("INSERT INTO salon_permission_overrides(salon_id,role,permission_key,permission_value) VALUES ($1,'employee','appointment.change_client','self')",[f.salonId])
  await api(f,'employee',async req=>{
    let r=await req(`/appointments/pet-options?client_id=${f.clientId}&appointment_id=${a.id}`);assert.equal(r.status,404)
    r=await req(`/appointments/${a.id}/recipient`,'PATCH',{client_id:f.clientId,recipient_type:'pet',pet_id:f.secondPetId,expected_recipient_revision:1});assert.equal(r.status,404)
  })
}))
test('recipient options DB: excludes archived pets and paginates duplicate names by ID',()=>fixture(async f=>{
  await pool.query('UPDATE client_pets SET active=false WHERE id=$1',[f.petId])
  await pool.query("INSERT INTO client_pets(salon_id,client_id,name,species) SELECT $1,$2,'Same','dog' FROM generate_series(1,51)",[f.salonId,f.clientId])
  const a=await getBookingPetOptions({salonId:f.salonId,clientId:f.clientId})
  const b=await getBookingPetOptions({salonId:f.salonId,clientId:f.clientId,afterId:a.next_cursor})
  assert.equal(a.pets.length,50);assert.equal(b.pets.length,2);assert.equal(b.next_cursor,null)
  assert.equal(new Set([...a.pets,...b.pets].map(p=>p.id)).size,52)
  assert.equal(a.pets.some(p=>Number(p.id)===f.petId),false)
}))

test('recipient DB: omitted grooming recipient rejected through appointment and booking services',()=>fixture(async f=>{
  await assert.rejects(prepareAppointmentCreation(legacy(f)),{code:'APPOINTMENT_PET_REQUIRED'})
  const {createBooking}=await import('../src/services/bookingService.js')
  await assert.rejects(createBooking({...legacy(f),date:'2030-01-09',start_time:'10:00'}),{code:'APPOINTMENT_PET_REQUIRED'})
  assert.equal((await findAllAppointments(f.salonId)).length,0)
  await pool.query("UPDATE salon_setup SET business_type='hair' WHERE salon_id=$1",[f.salonId])
  assert.equal((await create(legacy(f))).recipient_type,null)
}))
test('recipient API DB: business context is scoped and grooming omission rejected',()=>fixture(async f=>api(f,'employee',async req=>{
  const c=await req('/appointments/recipient-context')
  assert.equal(c.status,200);assert.equal(c.cache,'no-store')
  assert.deepEqual(c.body.data,{salon_id:f.salonId,business_type:'grooming'})
  const {salon_id,...body}=legacy(f)
  const a=await req('/appointments','POST',body)
  assert.equal(a.status,400);assert.equal(a.body.error.code,'APPOINTMENT_PET_REQUIRED')
})))
