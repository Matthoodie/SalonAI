import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {createCapacityService} from '../src/services/capacityService.js'
import {readCapacitySnapshot} from '../src/repositories/capacityRepository.js'
import {createFixedTenantTestApp} from './helpers/fixedTenantTestApp.js'
after(()=>pool.end())
const H=3600000,clock=()=>new Date('2030-01-07T07:00:00.000Z')
const get=createCapacityService({clock})
async function fixture(run) {
 const salons=[],users=[]
 const insertId=async(sql,args=[])=>String((await pool.query(sql,args)).rows[0].id)
 try{
  const salonId=await insertId("INSERT INTO salons(name,timezone) VALUES ('Capacity test','Europe/Zagreb') RETURNING id");salons.push(salonId)
  const foreignId=await insertId("INSERT INTO salons(name,timezone) VALUES ('Foreign capacity','Europe/Zagreb') RETURNING id");salons.push(foreignId)
  const token=randomUUID(),userId=await insertId("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id",['capacity_'+token,token+'@example.test']);users.push(userId)
  await pool.query("INSERT INTO salon_memberships(salon_id,user_id,role) VALUES ($1,$2,'owner')",[salonId,userId])
  const employeeId=await insertId("INSERT INTO employees(salon_id,name) VALUES ($1,'Ana') RETURNING id",[salonId])
  const foreignEmployeeId=await insertId("INSERT INTO employees(salon_id,name) VALUES ($1,'Foreign') RETURNING id",[foreignId])
  for(const eid of [employeeId,foreignEmployeeId])await pool.query("INSERT INTO employee_working_hours(employee_id,day_of_week,start_time,end_time) SELECT $1,d,'08:00'::time,'16:00'::time FROM generate_series(1,7)d",[eid])
  const serviceId=await insertId("INSERT INTO services(salon_id,name,category,price_cents,default_duration_minutes) VALUES ($1,'Cut','Other',1000,60) RETURNING id",[salonId])
  await pool.query('INSERT INTO employee_services(employee_id,service_id,salon_id) VALUES ($1,$2,$3)',[employeeId,serviceId,salonId])
  const clientId=await insertId("INSERT INTO clients(salon_id,name,is_occasional) VALUES ($1,'Test client',true) RETURNING id",[salonId])
  const book=async(start='2030-01-07T08:00:00Z',end='2030-01-07T09:00:00Z',status='confirmed')=>insertId(`INSERT INTO appointments(salon_id,employee_id,client_id,service_id,starts_at,ends_at,price_cents,duration_minutes,status)
    VALUES ($1,$2,$3,$4,$5,$6,1000,60,$7) RETURNING id`,[salonId,employeeId,clientId,serviceId,start,end,status])
  await run({salonId,userId,employeeId,foreignId,foreignEmployeeId,book})
 }finally{
  for(const id of salons)await pool.query('DELETE FROM appointments WHERE salon_id=$1',[id])
  for(const id of salons)await pool.query('DELETE FROM salons WHERE id=$1',[id])
  for(const id of users)await pool.query('DELETE FROM users WHERE id=$1',[id])
 }
}
test('capacity DB: complete salon-scoped schedules saved appointments and blocks',()=>fixture(async f=>{
 await f.book()
 await pool.query("INSERT INTO employee_blocked_times(employee_id,starts_at,ends_at) VALUES ($1,'2030-01-07T10:00:00Z','2030-01-07T11:00:00Z')",[f.employeeId])
 const r=await get(f,{days:'7'})
 assert.equal(r.active_employee_count,1);assert.equal(r.totals.capacity_ms,55*H);assert.equal(r.totals.occupied_ms,H)
 assert.equal(r.heatmap.reduce((n,c)=>n+c.capacity_ms,0),r.totals.capacity_ms)
 assert.deepEqual(r.employees.map(e=>e.employee_id),[f.employeeId]);assert.equal('appointments' in r,false)
}))
test('capacity DB: daily exceptions and effective absence take precedence',()=>fixture(async f=>{
 await pool.query("INSERT INTO employee_date_overrides(employee_id,date,enabled,start_time,end_time) VALUES ($1,'2030-01-07',true,'10:00','12:00'),($1,'2030-01-08',false,NULL,NULL)",[f.employeeId])
 await pool.query("INSERT INTO employee_time_off(employee_id,start_date,end_date,type) VALUES ($1,'2030-01-07','2030-01-07','vacation')",[f.employeeId])
 assert.equal((await get(f)).totals.capacity_ms,40*H)
}))
test('capacity DB: cancelled and inactive staff are excluded',()=>fixture(async f=>{
 await f.book(undefined,undefined,'cancelled')
 assert.equal((await get(f)).totals.booking_count,0)
 await pool.query('UPDATE employees SET active=false WHERE id=$1',[f.employeeId])
 const r=await get(f);assert.equal(r.active_employee_count,0);assert.equal(r.totals.utilization_percent,null)
}))
test('capacity DB: foreign salon employee role inactive membership and inactive user denied',()=>fixture(async f=>{
 await assert.rejects(get({...f,salonId:f.foreignId}),{code:'CAPACITY_FORBIDDEN'})
 await pool.query("UPDATE salon_memberships SET role='employee',employee_id=$3 WHERE salon_id=$1 AND user_id=$2",[f.salonId,f.userId,f.employeeId])
 await assert.rejects(get(f),{code:'CAPACITY_FORBIDDEN'})
 await pool.query("UPDATE salon_memberships SET role='admin',employee_id=NULL WHERE salon_id=$1 AND user_id=$2",[f.salonId,f.userId])
 assert.equal((await get(f)).totals.capacity_ms,56*H)
 await pool.query('UPDATE salon_memberships SET active=false WHERE salon_id=$1 AND user_id=$2',[f.salonId,f.userId])
 await assert.rejects(get(f),{code:'CAPACITY_FORBIDDEN'})
 await pool.query('UPDATE salon_memberships SET active=true WHERE salon_id=$1 AND user_id=$2',[f.salonId,f.userId])
 await pool.query('UPDATE users SET active=false WHERE id=$1',[f.userId])
 await assert.rejects(get(f),{code:'CAPACITY_FORBIDDEN'})
}))
test('capacity DB: anomalous outside-shift bookings remain visible without inflated utilization',()=>fixture(async f=>{
 await f.book('2030-01-07T16:00:00Z','2030-01-07T17:00:00Z')
 const r=await get(f);assert.equal(r.totals.outside_capacity_ms,H);assert.equal(r.totals.occupied_ms,0);assert.equal(r.totals.booking_count,1)
}))
test('capacity DB: concurrent schedule update cannot mix snapshots in one response',()=>fixture(async f=>{
 const service=createCapacityService({clock,readSnapshot:async(...args)=>{
  await pool.query("UPDATE employee_working_hours SET start_time='10:00' WHERE employee_id=$1",[f.employeeId])
  return readCapacitySnapshot(...args)
 }})
 assert.equal((await service(f)).totals.capacity_ms,56*H)
 assert.equal((await get(f)).totals.capacity_ms,42*H)
}))
test('capacity API DB: mounted private route returns report and blocks employee role',()=>fixture(async f=>{
 for(const role of ['owner','employee']){
  const app=createFixedTenantTestApp(f.salonId,{role,employeeId:f.employeeId,userId:f.userId})
  const server=app.listen(0);await new Promise(r=>server.once('listening',r))
  try{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/dashboard/capacity?days=7`)
   assert.equal(r.status,role==='owner'?200:403)
   if(role==='owner'){assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await r.json()).data.salon_id,f.salonId)}
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
 }
}))
