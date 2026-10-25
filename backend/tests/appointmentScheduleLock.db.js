import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as pause } from 'node:timers/promises'

import pool from '../src/database/pool.js'
import { createAppointmentBooking } from '../src/services/appointmentBookingService.js'
import { createBooking } from '../src/services/bookingService.js'
import {
  prepareAppointmentCreation,
  rescheduleAppointment,
} from '../src/services/appointmentService.js'
import { withAppointmentTransaction } from '../src/services/appointmentTransaction.js'

after(async () => {
  await pool.end()
})

async function fixture(run) {
  let salonId

  try {
    const salon = await pool.query(`
      INSERT INTO salons (name, timezone)
      VALUES ($1, 'Europe/Zagreb') RETURNING id
    `, [`Schedule Lock ${Date.now()}-${process.pid}`])
    salonId = Number(salon.rows[0].id)

    const employee = await pool.query(`
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Schedule Lock Employee') RETURNING id
    `, [salonId])
    const employeeId = Number(employee.rows[0].id)

    const client = await pool.query(`
      INSERT INTO clients (
        salon_id, name, phone_country_code,
        phone_number, phone_normalized
      ) VALUES ($1, 'Schedule Lock Client', '+385', '911234567', '+385911234567')
      RETURNING id
    `, [salonId])

    const service = await pool.query(`
      INSERT INTO services (
        salon_id, name, category, price_cents, default_duration_minutes
      ) VALUES ($1, 'Schedule Lock Service', 'Test', 3000, 30)
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

async function insertTimeOff(db, employeeId) {
  await db.query(`
    INSERT INTO employee_time_off (
      employee_id, start_date, end_date, type
    ) VALUES ($1, '2030-01-09', '2030-01-09', 'vacation')
  `, [employeeId])
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

async function commitTimeOffWhileWaiting(context, operation) {
  const blocker = await pool.connect()
  let pending

  try {
    await blocker.query('BEGIN')
    const pid = await blocker.query('SELECT pg_backend_pid() AS pid')
    await blocker.query(`
      SELECT id FROM employees
      WHERE id = $1 AND salon_id = $2 FOR UPDATE
    `, [context.employeeId, context.salonId])

    // Observe completion without leaving a rejected promise unhandled.
    pending = operation().then(
      (result) => ({ result }),
      (error) => ({ error })
    )

    await waitForEmployeeLock(pid.rows[0].pid)
    await insertTimeOff(blocker, context.employeeId)
    await blocker.query('COMMIT')

    const outcome = await pending
    if (outcome.error) throw outcome.error
    assert.equal(outcome.result.error?.code, 'EMPLOYEE_TIME_OFF')
    assert.equal(outcome.result.error?.status, 409)
  } finally {
    await blocker.query('ROLLBACK')
    blocker.release()
    if (pending) await pending
  }
}

test('schedule lock: manual booking waits and sees committed time off', async () => {
  await fixture(async (context) => {
    await commitTimeOffWhileWaiting(context, () =>
      createAppointmentBooking(context.input)
    )
    const rows = await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [context.salonId])
    assert.equal(rows.rowCount, 0)
  })
})

test('schedule lock: public booking uses the same employee lock', async () => {
  await fixture(async (context) => {
    await commitTimeOffWhileWaiting(context, () => createBooking({
      ...context.input,
      date: '2030-01-09',
      start_time: '10:00',
    }))
  })
})

test('schedule lock: rejected booking rolls back its new client', async () => {
  await fixture(async (context) => {
    const { client_id, ...input } = context.input
    assert.ok(client_id)

    await commitTimeOffWhileWaiting(context, () => createAppointmentBooking({
      ...input,
      newClient: {
        name: 'Must Be Rolled Back',
        is_occasional: true,
      },
    }))

    const clients = await pool.query('SELECT name FROM clients WHERE salon_id = $1', [context.salonId])
    assert.deepEqual(clients.rows.map((row) => row.name), ['Schedule Lock Client'])
    const appointments = await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [context.salonId])
    assert.equal(appointments.rowCount, 0)
  })
})

test('schedule lock: rescheduling waits and preserves the original time on rejection', async () => {
  await fixture(async (context) => {
    const originalTime = '2030-01-08T09:00:00.000Z'
    const created = await createAppointmentBooking({
      ...context.input,
      starts_at: originalTime,
    })
    assert.equal(created.error, undefined)

    await commitTimeOffWhileWaiting(context, () => rescheduleAppointment(
      Number(created.data.id),
      context.salonId,
      context.input.starts_at,
      context.employeeId
    ))

    const saved = await pool.query('SELECT starts_at FROM appointments WHERE id = $1', [created.data.id])
    assert.equal(new Date(saved.rows[0].starts_at).toISOString(), originalTime)
  })
})

test('schedule transaction: availability reads uncommitted changes on the supplied connection', async () => {
  await fixture(async (context) => {
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      await insertTimeOff(db, context.employeeId)
      const result = await prepareAppointmentCreation(context.input, db)
      assert.equal(result.error?.code, 'EMPLOYEE_TIME_OFF')
    } finally {
      await db.query('ROLLBACK')
      db.release()
    }

    const saved = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
    assert.equal(saved.rowCount, 0)
  })
})

test('schedule transaction: returned domain error rolls back earlier writes', async () => {
  await fixture(async (context) => {
    const result = await withAppointmentTransaction(async (db) => {
      await insertTimeOff(db, context.employeeId)
      return { error: { status: 409, code: 'TEST_REJECTED' } }
    })

    assert.equal(result.error.code, 'TEST_REJECTED')
    const saved = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
    assert.equal(saved.rowCount, 0)
  })
})

test('schedule transaction: thrown error rolls back earlier writes', async () => {
  await fixture(async (context) => {
    await assert.rejects(
      withAppointmentTransaction(async (db) => {
        await insertTimeOff(db, context.employeeId)
        throw new Error('Expected transaction failure')
      }),
      /Expected transaction failure/
    )

    const saved = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
    assert.equal(saved.rowCount, 0)
  })
})
