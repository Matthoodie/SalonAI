import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/database/pool.js'
import { prepareAppointmentCreation, changeAppointmentServices, rescheduleAppointment } from '../src/services/appointmentService.js'
import { createAppointmentBooking } from '../src/services/appointmentBookingService.js'
import { getAvailabilityDayContext } from '../src/services/availabilityService.js'
import { findAppointmentById } from '../src/repositories/appointmentRepository.js'
import { createFixedTenantTestApp } from './helpers/fixedTenantTestApp.js'
import { up, down } from '../migrations/1793383200000_create-appointment-items.js'

after(() => pool.end())

async function fixture(run) {
  let salonId
  try {
    salonId = Number((await pool.query("INSERT INTO salons (name, timezone) VALUES ('Multi-service test', 'Europe/Zagreb') RETURNING id")).rows[0].id)
    const employeeId = Number((await pool.query("INSERT INTO employees (salon_id, name) VALUES ($1, 'Multi employee') RETURNING id", [salonId])).rows[0].id)
    const clientId = Number((await pool.query(`INSERT INTO clients (salon_id, name, phone_country_code, phone_number, phone_normalized)
      VALUES ($1, 'Multi client', '+385', '911234567', '+385911234567') RETURNING id`, [salonId])).rows[0].id)
    const services = []
    for (const [name, price, duration] of [['Cut', 1800, 20], ['Dry', 1800, 30], ['Extra', 500, 10]]) {
      services.push(Number((await pool.query(`INSERT INTO services (salon_id, name, category, price_cents, default_duration_minutes)
        VALUES ($1,$2,'Test',$3,$4) RETURNING id`, [salonId, name, price, duration])).rows[0].id))
    }
    await pool.query(`INSERT INTO employee_services (employee_id, service_id, salon_id)
      SELECT $1, unnest($2::bigint[]), $3`, [employeeId, services, salonId])
    await pool.query(`INSERT INTO employee_working_hours (employee_id, day_of_week, start_time, end_time)
      SELECT $1, d, '08:00'::time, '18:00'::time FROM generate_series(1,7) d`, [employeeId])
    const input = { salon_id: salonId, employee_id: employeeId, client_id: clientId,
      service_ids: services.slice(0,2), starts_at: '2030-01-09T09:00:00.000Z' }
    await run({ salonId, employeeId, clientId, services, input })
  } finally {
    if (salonId) {
      await pool.query('DELETE FROM appointments WHERE salon_id = $1', [salonId])
      await pool.query('DELETE FROM salons WHERE id = $1', [salonId])
    }
  }
}
async function created(input) {
  const result = await prepareAppointmentCreation(input)
  assert.equal(result.error, undefined, JSON.stringify(result.error))
  return result.data
}
async function withApi(f, role, run) {
  const app = createFixedTenantTestApp(f.salonId, { role, employeeId: f.employeeId })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  try { await run(request) } finally {
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('multi: two services produce one 50 minute reservation and snapshots', () => fixture(async (f) => {
  const a = await created(f.input)
  assert.equal(a.duration_minutes, 50)
  assert.equal(a.price_cents, 3600)
  assert.equal(new Date(a.ends_at).toISOString(), '2030-01-09T09:50:00.000Z')
  assert.deepEqual(a.items.map(i => Number(i.service_id)), f.services.slice(0,2))
  assert.equal((await pool.query('SELECT count(*)::int n FROM appointments WHERE salon_id=$1', [f.salonId])).rows[0].n, 1)
}))
test('multi: catalogue changes never change saved item snapshots or total', () => fixture(async (f) => {
  const a = await created(f.input)
  await pool.query("UPDATE services SET name='Changed', price_cents=9900, default_duration_minutes=90 WHERE id=$1", [f.services[0]])
  const read = await findAppointmentById(a.id, f.salonId)
  assert.equal(read.items[0].name, 'Cut')
  assert.equal(read.price_cents, 3600)
  assert.equal(read.items[0].duration_minutes, 20)
}))
test('multi: legacy single creation remains supported', () => fixture(async (f) => {
  const { service_ids, ...input } = f.input
  const a = await created({ ...input, service_id: f.services[0] })
  assert.equal(a.items.length, 1)
  assert.equal(a.duration_minutes, 20)
}))
test('multi: collision only in second service still rejects entire booking', () => fixture(async (f) => {
  await created({ ...f.input, service_ids: [f.services[2]], starts_at: '2030-01-09T09:30:00Z' })
  const result = await prepareAppointmentCreation(f.input)
  assert.equal(result.error.code, 'APPOINTMENT_CONFLICT')
  assert.equal((await pool.query('SELECT count(*)::int n FROM appointments WHERE salon_id=$1',[f.salonId])).rows[0].n,1)
}))
test('multi: touching end boundary is allowed', () => fixture(async (f) => {
  await created(f.input)
  await created({ ...f.input, starts_at: '2030-01-09T09:50:00Z' })
}))
test('multi: combined duration must fit working window', () => fixture(async (f) => {
  const result = await prepareAppointmentCreation({ ...f.input, starts_at: '2030-01-09T16:30:00Z' })
  assert.ok(result.error)
}))
test('multi: second service requires employee qualification', () => fixture(async (f) => {
  await pool.query('DELETE FROM employee_services WHERE employee_id=$1 AND service_id=$2',[f.employeeId,f.services[1]])
  assert.equal((await prepareAppointmentCreation(f.input)).error.code,'EMPLOYEE_NOT_QUALIFIED')
}))
test('multi: inactive second service is rejected', () => fixture(async (f) => {
  await pool.query('UPDATE services SET active=false WHERE id=$1',[f.services[1]])
  assert.equal((await prepareAppointmentCreation(f.input)).error.code,'SERVICE_INACTIVE')
}))
test('multi: foreign salon service cannot be attached', () => fixture(async (f) => fixture(async (other) => {
  assert.equal((await prepareAppointmentCreation({ ...f.input, service_ids:[f.services[0],other.services[0]] })).error.code,'SERVICE_SALON_MISMATCH')
})))
test('multi: duplicate selection leaves no reservation', () => fixture(async (f) => {
  assert.ok((await prepareAppointmentCreation({ ...f.input, service_ids:[f.services[0],f.services[0]] })).error)
  assert.equal((await pool.query('SELECT count(*)::int n FROM appointments WHERE salon_id=$1',[f.salonId])).rows[0].n,0)
}))
test('multi: failed new-client booking rolls back the client too', () => fixture(async (f) => {
  await created(f.input)
  const before = (await pool.query('SELECT count(*)::int n FROM clients WHERE salon_id=$1',[f.salonId])).rows[0].n
  const { client_id, ...input } = f.input
  const result = await createAppointmentBooking({ ...input, newClient: {
    name:'Rollback multi', is_occasional:false, phone_country_code:'+385',
    phone_number:'922345678', phone_normalized:'+385922345678',
  } })
  assert.equal(result.error.code,'APPOINTMENT_CONFLICT')
  assert.equal((await pool.query('SELECT count(*)::int n FROM clients WHERE salon_id=$1',[f.salonId])).rows[0].n,before)
}))
test('multi: changing composition retains old snapshots and prices only new items', () => fixture(async (f) => {
  const a = await created(f.input)
  await pool.query("UPDATE services SET price_cents=9999, default_duration_minutes=90, name='Changed' WHERE id=$1",[f.services[0]])
  const changed = await changeAppointmentServices(a.id,f.salonId,[f.services[0],f.services[2]])
  assert.equal(changed.error,undefined)
  assert.equal(changed.data.price_cents,2300)
  assert.equal(changed.data.duration_minutes,30)
  assert.equal(changed.data.items[0].name,'Cut')
  assert.equal(changed.data.items[1].name,'Extra')
}))
test('multi: adding to a single-service booking preserves its original snapshot', () => fixture(async (f) => {
  const a = await created({ ...f.input, service_ids:[f.services[0]] })
  const result = await changeAppointmentServices(a.id,f.salonId,f.services.slice(0,2))
  assert.equal(result.error,undefined)
  assert.equal(result.data.items[0].duration_minutes,20)
  assert.equal(result.data.duration_minutes,50)
}))
test('multi: removing down to one service gives matching totals', () => fixture(async (f) => {
  const a = await created(f.input)
  const result = await changeAppointmentServices(a.id,f.salonId,[f.services[1]])
  assert.equal(result.error,undefined)
  assert.equal(result.data.duration_minutes,30)
  assert.equal(result.data.price_cents,1800)
  assert.equal(Number(result.data.service_id),f.services[1])
}))
test('multi: conflicting extension rolls back header and items', () => fixture(async (f) => {
  const a = await created({ ...f.input, service_ids:[f.services[0]] })
  await created({ ...f.input, starts_at:'2030-01-09T09:30:00Z' })
  const result = await changeAppointmentServices(a.id,f.salonId,f.services.slice(0,2))
  assert.equal(result.error.code,'APPOINTMENT_CONFLICT')
  const read = await findAppointmentById(a.id,f.salonId)
  assert.equal(read.duration_minutes,20)
  assert.equal(read.items.length,1)
}))
test('multi: resolved booking and foreign salon composition cannot change', () => fixture(async (f) => {
  const a = await created(f.input)
  assert.equal((await changeAppointmentServices(a.id,f.salonId+1000000,[f.services[0]])).error.status,404)
  await pool.query("UPDATE appointments SET status='completed' WHERE id=$1",[a.id])
  assert.equal((await changeAppointmentServices(a.id,f.salonId,[f.services[0]])).error.status,409)
}))
test('multi: rescheduling uses saved combined duration and retains all items', () => fixture(async (f) => {
  const a = await created(f.input)
  const result = await rescheduleAppointment(a.id,f.salonId,'2030-01-09T11:00:00Z')
  assert.equal(result.error,undefined)
  assert.equal(new Date(result.data.ends_at).toISOString(),'2030-01-09T11:50:00.000Z')
  assert.equal(result.data.items.length,2)
}))
test('multi: availability excludes slots where only the first service fits', () => fixture(async (f) => {
  await created({ ...f.input, service_ids:[f.services[2]], starts_at:'2030-01-09T09:30:00Z' })
  const single = await getAvailabilityDayContext({ employeeId:f.employeeId,serviceId:f.services[0],date:'2030-01-09' })
  const multi = await getAvailabilityDayContext({ employeeId:f.employeeId,serviceIds:f.services.slice(0,2),date:'2030-01-09' })
  assert.equal(multi.error,undefined)
  assert.ok(single.data.availableSlots.includes('10:00'))
  assert.ok(!multi.data.availableSlots.includes('10:00'))
  assert.equal(multi.data.service.default_duration_minutes,50)
}))
test('multi: simultaneous overlapping creates allow only one reservation', () => fixture(async (f) => {
  const results = await Promise.all([prepareAppointmentCreation(f.input),prepareAppointmentCreation(f.input)])
  assert.equal(results.filter(r=>r.data).length,1)
  assert.equal(results.filter(r=>r.error?.code==='APPOINTMENT_CONFLICT').length,1)
}))
test('multi: database refuses item total tampering and orphan removal', () => fixture(async (f) => {
  const a = await created(f.input)
  await assert.rejects(pool.query('UPDATE appointment_items SET price_cents=1 WHERE appointment_id=$1 AND position=2',[a.id]), { code:'23514' })
  await assert.rejects(pool.query('DELETE FROM appointment_items WHERE appointment_id=$1',[a.id]), { code:'23514' })
  assert.equal((await findAppointmentById(a.id,f.salonId)).items.length,2)
}))
test('multi: database protects qualification of second item too', () => fixture(async (f) => {
  await created(f.input)
  await assert.rejects(
    pool.query('DELETE FROM employee_services WHERE employee_id=$1 AND service_id=$2',
      [f.employeeId, f.services[1]]),
    (error) => ['23001', '23503'].includes(error.code) &&
      error.constraint === 'appointment_items_qualified_fkey'
  )
  const retained = await pool.query(
    'SELECT service_id FROM employee_services WHERE employee_id=$1 AND service_id=$2 AND salon_id=$3',
    [f.employeeId, f.services[1], f.salonId]
  )
  assert.equal(retained.rows.length, 1)
}))
test('multi API: create, list and calendar retain one reservation with two items', () => fixture(async (f) => withApi(f,'owner',async request=>{
  const result=await request('/api/appointments','POST',f.input)
  assert.equal(result.status,201,JSON.stringify(result.body))
  assert.equal(result.body.data.items.length,2)
  const list=await request('/api/appointments')
  assert.equal(list.status,200)
  assert.equal(list.body.data.length,1)
  assert.equal(list.body.data[0].items.length,2)
  const calendar=await request('/api/calendar?from=2030-01-09&to=2030-01-09')
  assert.equal(calendar.status,200,JSON.stringify(calendar.body))
  assert.equal(calendar.body.data.appointments.length,1)
  assert.equal(calendar.body.data.appointments[0].items.length,2)
})))
test('multi API: owner can change services and injected totals are ignored', () => fixture(async (f) => withApi(f,'owner',async request=>{
  const a=await created(f.input)
  const result=await request(`/api/appointments/${a.id}/services`,'PATCH',{service_ids:[f.services[0]],price_cents:1,duration_minutes:1})
  assert.equal(result.status,200,JSON.stringify(result.body))
  assert.equal(result.body.data.duration_minutes,20)
  assert.equal(result.body.data.price_cents,1800)
})))
test('multi API: employee cannot use composition edit endpoint', () => fixture(async (f) => withApi(f,'employee',async request=>{
  const a=await created(f.input)
  const result=await request(`/api/appointments/${a.id}/services`,'PATCH',{service_ids:[f.services[0]]})
  assert.equal(result.status,403)
  assert.equal((await findAppointmentById(a.id,f.salonId)).items.length,2)
})))
test('multi API: public booking accepts service list and availability reports total', () => fixture(async (f) => withApi(f,'owner',async request=>{
  const availability=await request(`/api/availability?employeeId=${f.employeeId}&serviceIds=${f.services.slice(0,2).join(',')}&date=2030-01-09`)
  assert.equal(availability.status,200,JSON.stringify(availability.body))
  assert.equal(availability.body.data.durationMinutes,50)
  const { starts_at, ...input }=f.input
  const result=await request('/api/bookings','POST',{...input,date:'2030-01-09',start_time:'10:00'})
  assert.equal(result.status,201,JSON.stringify(result.body))
  assert.equal(result.body.data.items.length,2)
})))

// Exercise the real migration on an isolated, minimal copy of the old schema.
// No production tables or global migration history are changed.
test('multi migration: backfill preserves historical totals, legacy writes work, down guards multi items', async () => {
  const db=await pool.connect()
  const schema=`multi_migration_${process.pid}_${Date.now()}`
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA "${schema}"`)
    await db.query(`SET LOCAL search_path TO "${schema}", public`)
    await db.query(`
      CREATE TABLE services (id bigint PRIMARY KEY, salon_id bigint, name varchar(150),category varchar(100));
      CREATE TABLE employee_services (employee_id bigint,service_id bigint,salon_id bigint,UNIQUE(employee_id,service_id,salon_id));
      CREATE TABLE appointments (id bigint PRIMARY KEY,salon_id bigint,employee_id bigint,service_id bigint,price_cents integer,duration_minutes integer);
      INSERT INTO services VALUES (1,1,'Current name','Test'),(2,1,'Second','Test');
      INSERT INTO employee_services VALUES(1,1,1),(1,2,1);
      INSERT INTO appointments VALUES(1,1,1,1,1234,17);
    `)
    const sql=[];up({sql:s=>sql.push(s)})
    for(const statement of sql) await db.query(statement)
    const old=(await db.query('SELECT * FROM appointment_items WHERE appointment_id=1')).rows[0]
    assert.equal(old.price_cents,1234)
    assert.equal(old.duration_minutes,17)
    await db.query('INSERT INTO appointments VALUES(2,1,1,1,800,10)')
    assert.equal((await db.query('SELECT count(*)::int n FROM appointment_items')).rows[0].n,2)
    await db.query('DELETE FROM appointment_items WHERE appointment_id=2')
    await db.query('UPDATE appointments SET price_cents=900,duration_minutes=20 WHERE id=2')
    await db.query(`INSERT INTO appointment_items VALUES
      (2,1,1,1,1,'First','Test',800,10),(2,1,1,2,2,'Second','Test',100,10)`)
    await db.query('SET CONSTRAINTS ALL IMMEDIATE')
    const rollback=[];down({sql:s=>rollback.push(s)})
    await db.query('SAVEPOINT reject_down')
    await assert.rejects(db.query(rollback.join('\n')), /multi-service reservations exist/)
    await db.query('ROLLBACK TO SAVEPOINT reject_down')
  } finally {
    await db.query('ROLLBACK')
    db.release()
  }
})

test('multi: a block intersecting only the second service rejects the whole booking', () => fixture(async (f) => {
  await pool.query(`INSERT INTO employee_blocked_times (employee_id,starts_at,ends_at,type)
    VALUES ($1,'2030-01-09T09:30:00Z','2030-01-09T09:40:00Z','BREAK')`,[f.employeeId])
  assert.equal((await prepareAppointmentCreation(f.input)).error.code,'EMPLOYEE_BLOCKED_TIME')
}))
test('multi: time off prevents creation and service extension', () => fixture(async (f) => {
  const a=await created({ ...f.input,service_ids:[f.services[0]] })
  await pool.query(`INSERT INTO employee_time_off (employee_id,start_date,end_date,type)
    VALUES ($1,'2030-01-09','2030-01-09','vacation')`,[f.employeeId])
  assert.equal((await changeAppointmentServices(a.id,f.salonId,f.services.slice(0,2))).error.code,'EMPLOYEE_TIME_OFF')
  assert.equal((await prepareAppointmentCreation({ ...f.input,starts_at:'2030-01-09T11:00:00Z' })).error.code,'EMPLOYEE_TIME_OFF')
  assert.equal((await findAppointmentById(a.id,f.salonId)).duration_minutes,20)
}))
test('multi API: employee creation is still limited to own employee identity', () => fixture(async (f) => withApi(f,'employee',async request=>{
  const own=await request('/api/appointments','POST',f.input)
  assert.equal(own.status,201,JSON.stringify(own.body))
  const coworker=Number((await pool.query("INSERT INTO employees (salon_id,name) VALUES ($1,'Coworker') RETURNING id",[f.salonId])).rows[0].id)
  const foreign=await request('/api/appointments','POST',{ ...f.input,employee_id:coworker })
  assert.equal(foreign.status,403,JSON.stringify(foreign.body))
})))
test('multi API: selected salon context overrides injected salon ID', () => fixture(async (f) => fixture(async other => withApi(f,'owner',async request=>{
  const response=await request('/api/appointments','POST',{ ...f.input,salon_id:other.salonId })
  assert.equal(response.status,201,JSON.stringify(response.body))
  assert.equal(Number(response.body.data.salon_id),f.salonId)
  const edit=await request(`/api/appointments/${response.body.data.id}/services`,'PATCH',{service_ids:other.services.slice(0,2),salon_id:other.salonId})
  assert.equal(edit.status,400)
  assert.equal((await findAppointmentById(response.body.data.id,f.salonId)).items.length,2)
}))))
