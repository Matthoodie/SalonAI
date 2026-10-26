import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as pause } from 'node:timers/promises'
import pool from '../src/database/pool.js'
import { updateEmployeeForSalon } from '../src/services/employeeService.js'
import { prepareAppointmentCreation } from '../src/services/appointmentService.js'

after(async () => { await pool.end() })

async function fixture(run) {
  let salonId

  try {
    const salon = await pool.query(`
      INSERT INTO salons (name, timezone)
      VALUES ($1, 'Europe/Zagreb') RETURNING id
    `, [`Schedule Protection ${Date.now()}-${process.pid}`])
    salonId = Number(salon.rows[0].id)

    const employee = await pool.query(`
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Schedule Protection Employee') RETURNING id
    `, [salonId])
    const employeeId = Number(employee.rows[0].id)

    const client = await pool.query(`
      INSERT INTO clients (
        salon_id, name, phone_country_code,
        phone_number, phone_normalized
      ) VALUES ($1, 'Schedule Protection Client', '+385', '911234567', '+385911234567')
      RETURNING id
    `, [salonId])

    const service = await pool.query(`
      INSERT INTO services (
        salon_id, name, category, price_cents, default_duration_minutes
      ) VALUES ($1, 'Schedule Protection Service', 'Test', 3000, 30)
      RETURNING id
    `, [salonId])

    const serviceId = Number(service.rows[0].id)
    await pool.query(`
      INSERT INTO employee_services (employee_id, service_id, salon_id)
      VALUES ($1, $2, $3)
    `, [employeeId, serviceId, salonId])

    await pool.query(`
      INSERT INTO employee_working_hours (
        employee_id, day_of_week, start_time, end_time
      )
      SELECT $1::bigint, day, '08:00'::time, '18:00'::time
      FROM generate_series(1, 7) AS day
    `, [employeeId])

    await run({
      salonId,
      employeeId,
      input: {
        salon_id: salonId,
        employee_id: employeeId,
        client_id: Number(client.rows[0].id),
        service_id: serviceId,
        starts_at: '2030-01-09T09:00:00.000Z',
      },
    })
  } finally {
    if (salonId) {
      await pool.query('DELETE FROM appointments WHERE salon_id = $1', [salonId])
      await pool.query('DELETE FROM salons WHERE id = $1', [salonId])
    }
  }
}

async function waitForEmployeeLock(blockerPid) {
  const deadline = Date.now() + 5000

  while (Date.now() < deadline) {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database()
          AND $1::integer = ANY(pg_blocking_pids(pid))
          AND query ILIKE '%FROM employees%'
          AND query ILIKE '%FOR UPDATE%'
      ) AS waiting
    `, [blockerPid])

    if (result.rows[0].waiting) return
    await pause(10)
  }

  assert.fail('Expected the operation to wait for the employee row lock before validating availability.')
}

async function appointment(context, start, end, status = 'confirmed') {
  const input = context.input
  return pool.query(`
    INSERT INTO appointments (
      salon_id, client_id, employee_id, service_id, starts_at, ends_at,
      price_cents, duration_minutes, status, source
    ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, 3000, $7, $8, 'manual')
    RETURNING id
  `, [context.salonId, input.client_id, context.employeeId, input.service_id,
    start, end, (Date.parse(end) - Date.parse(start)) / 60000, status])
}


const date = '2030-01-09'
const override = (start = '08:00', end = '18:00', day = date) => ({ date: day, enabled: true, start_time: start, end_time: end })
const dayOff = { date, enabled: false, start_time: null, end_time: null }
const hours = (start = '08:00', end = '18:00') => Array.from({ length: 7 }, (_, i) => ({ day_of_week: i + 1, start_time: start, end_time: end }))
const save = (c, fields) => updateEmployeeForSalon({ salonId: c.salonId, employeeId: c.employeeId, ...fields })
const book = (c, status = 'confirmed', start = '2030-01-09T09:00:00.000Z', end = '2030-01-09T09:30:00.000Z') => appointment(c, start, end, status)
const conflict = (operation) => assert.rejects(operation, error => error.code === 'EMPLOYEE_SCHEDULE_APPOINTMENT_CONFLICT' && error.statusCode === 409)
async function read(c) {
  return {
    employee: (await pool.query('SELECT name, active FROM employees WHERE id = $1', [c.employeeId])).rows,
    hours: (await pool.query('SELECT day_of_week, start_time, end_time FROM employee_working_hours WHERE employee_id = $1 ORDER BY day_of_week', [c.employeeId])).rows,
    overrides: (await pool.query("SELECT date::text, enabled, start_time, end_time FROM employee_date_overrides WHERE employee_id = $1 ORDER BY date", [c.employeeId])).rows,
    appointments: (await pool.query('SELECT id, starts_at, ends_at, status FROM appointments WHERE employee_id = $1 ORDER BY id', [c.employeeId])).rows,
  }
}
for (const status of ['pending', 'confirmed']) {
  test(`schedule protection: ${status} appointment prevents day off and preserves all data`, async () => fixture(async c => {
    await book(c, status)
    const before = await read(c)
    await conflict(() => save(c, { name: 'Must roll back', dateOverrides: [dayOff] }))
    assert.deepEqual(await read(c), before)
  }))
}
for (const status of ['cancelled', 'completed', 'no_show']) {
  test(`schedule protection: ${status} does not block schedule change`, async () => fixture(async c => {
    await book(c, status)
    await save(c, { dateOverrides: [dayOff] })
    assert.equal((await read(c)).overrides[0].enabled, false)
  }))
}
for (const [label, start, end] of [['late start', '10:15', '18:00'], ['early end', '08:00', '10:15']]) {
  test(`schedule protection: override ${label} rejects partial overlap`, async () => fixture(async c => {
    await book(c)
    await conflict(() => save(c, { dateOverrides: [override(start, end)] }))
  }))
}
test('schedule protection: exact appointment boundaries are accepted', async () => fixture(async c => {
  await book(c)
  await save(c, { dateOverrides: [override('10:00', '10:30')] })
  assert.equal((await read(c)).overrides[0].start_time, '10:00:00')
}))
test('schedule protection: deleting override cannot expose incompatible weekly hours', async () => fixture(async c => {
  await save(c, { workingHours: hours('12:00', '18:00'), dateOverrides: [override()] })
  await book(c)
  const before = await read(c)
  await conflict(() => save(c, { dateOverrides: [] }))
  assert.deepEqual(await read(c), before)
}))
test('schedule protection: deleting override with compatible weekly hours succeeds', async () => fixture(async c => {
  await save(c, { dateOverrides: [override('09:00', '17:00')] })
  await book(c)
  await save(c, { dateOverrides: [] })
  assert.equal((await read(c)).overrides.length, 0)
}))
test('schedule protection: weekly hours cannot shrink across an appointment', async () => fixture(async c => {
  await book(c)
  await conflict(() => save(c, { workingHours: hours('11:00', '18:00') }))
  await conflict(() => save(c, { workingHours: [] }))
}))
test('schedule protection: date override still wins over changed weekly hours', async () => fixture(async c => {
  await save(c, { dateOverrides: [override()] })
  await book(c)
  await save(c, { workingHours: [] })
  assert.equal((await read(c)).hours.length, 0)
}))
test('schedule protection: simultaneous replacements use the final combined schedule', async () => fixture(async c => {
  await save(c, { workingHours: hours('12:00', '18:00'), dateOverrides: [override()] })
  await book(c)
  await save(c, { workingHours: hours(), dateOverrides: [] })
  assert.equal((await read(c)).overrides.length, 0)
}))
test('schedule protection: one conflict rolls back all dates and profile fields', async () => fixture(async c => {
  await book(c)
  const before = await read(c)
  await conflict(() => save(c, { name: 'Not saved', active: false, dateOverrides: [override('09:00', '17:00', '2030-01-10'), dayOff] }))
  assert.deepEqual(await read(c), before)
}))
test('schedule protection: unchanged effective day does not block unrelated changes', async () => fixture(async c => {
  await book(c, 'confirmed', '2030-01-09T05:00:00.000Z', '2030-01-09T05:30:00.000Z')
  await save(c, { name: 'Allowed', workingHours: hours(), dateOverrides: [override('09:00', '17:00', '2030-01-10')] })
  assert.equal((await read(c)).employee[0].name, 'Allowed')
}))
test('schedule protection: omitted schedule preserves existing rows', async () => fixture(async c => {
  await book(c)
  const before = await read(c)
  await save(c, { name: 'Only name' })
  const after = await read(c)
  assert.deepEqual(after.hours, before.hours)
  assert.deepEqual(after.overrides, before.overrides)
  assert.deepEqual(after.appointments, before.appointments)
}))
test('schedule protection: foreign employee id cannot modify schedules', async () => fixture(async a => fixture(async b => {
  const before = await read(b)
  await assert.rejects(() => save({ ...a, employeeId: b.employeeId }, { dateOverrides: [dayOff] }), e => e.code === 'EMPLOYEE_NOT_FOUND')
  assert.deepEqual(await read(b), before)
})))
test('schedule protection: coworker and other salon appointments do not block edits', async () => fixture(async a => fixture(async b => {
  await book(b)
  const coworker = (await pool.query("INSERT INTO employees(salon_id, name) VALUES ($1, 'Coworker') RETURNING id", [a.salonId])).rows[0]
  await book(a)
  await save({ ...a, employeeId: Number(coworker.id) }, { dateOverrides: [dayOff] })
})))
test('schedule protection: salon local date is used instead of UTC date', async () => fixture(async c => {
  await pool.query("UPDATE salons SET timezone = 'America/New_York' WHERE id = $1", [c.salonId])
  await save(c, { workingHours: hours('00:00', '23:59') })
  await book(c, 'confirmed', '2030-01-10T02:00:00.000Z', '2030-01-10T02:30:00.000Z')
  await conflict(() => save(c, { dateOverrides: [dayOff] }))
  await save(c, { dateOverrides: [{ ...dayOff, date: '2030-01-10' }] })
}))
test('schedule protection: spring and autumn offsets use salon local time', async () => fixture(async c => {
  for (const [day, start] of [['2030-03-31', '2030-03-31T08:00:00.000Z'], ['2030-10-27', '2030-10-27T09:00:00.000Z']]) {
    await book(c, 'confirmed', start, new Date(Date.parse(start) + 1800000).toISOString())
    await conflict(() => save(c, { dateOverrides: [override('11:00', '18:00', day)] }))
    await save(c, { dateOverrides: [override('10:00', '10:30', day)] })
  }
}))
test('schedule protection: later booking observes shortened schedule', async () => fixture(async c => {
  await save(c, { dateOverrides: [override('12:00', '18:00')] })
  const result = await prepareAppointmentCreation(c.input)
  assert.equal(result.error?.code, 'APPOINTMENT_OUTSIDE_WORKING_HOURS')
  assert.equal((await read(c)).appointments.length, 0)
}))
test('schedule protection: profile update waits for booking commit and rejects conflict', async () => fixture(async c => {
  const db = await pool.connect()
  let pending
  try {
    await db.query('BEGIN')
    const pid = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const booked = await prepareAppointmentCreation(c.input, db)
    assert.equal(booked.error, undefined)
    pending = save(c, { dateOverrides: [dayOff] }).then(result => ({ result }), error => ({ error }))
    await waitForEmployeeLock(pid)
    await db.query('COMMIT')
    const outcome = await pending
    assert.equal(outcome.error?.code, 'EMPLOYEE_SCHEDULE_APPOINTMENT_CONFLICT')
    assert.equal((await read(c)).overrides.length, 0)
    assert.equal((await read(c)).appointments.length, 1)
  } finally {
    await db.query('ROLLBACK'); db.release()
    if (pending) await pending
  }
}))
test('schedule protection: waiting booking sees newly committed day off', async () => fixture(async c => {
  const db = await pool.connect()
  let pending
  try {
    await db.query('BEGIN')
    const pid = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    await db.query('SELECT id FROM employees WHERE id = $1 AND salon_id = $2 FOR UPDATE', [c.employeeId, c.salonId])
    await db.query('INSERT INTO employee_date_overrides(employee_id, date, enabled) VALUES ($1, $2, false)', [c.employeeId, date])
    pending = prepareAppointmentCreation(c.input).then(result => ({ result }), error => ({ error }))
    await waitForEmployeeLock(pid)
    await db.query('COMMIT')
    const outcome = await pending
    assert.equal(outcome.error, undefined)
    assert.equal(outcome.result.error?.code, 'EMPLOYEE_UNAVAILABLE')
    assert.equal((await read(c)).appointments.length, 0)
  } finally {
    await db.query('ROLLBACK'); db.release()
    if (pending) await pending
  }
}))
