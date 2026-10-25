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

function timeOff(start = '2030-01-09', end = start) {
  return [{ start_date: start, end_date: end, type: 'vacation' }]
}

function save(context, entries, extra = {}) {
  return updateEmployeeForSalon({
    salonId: context.salonId,
    employeeId: context.employeeId,
    timeOff: entries,
    ...extra,
  })
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

async function rejectConflict(operation) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT')
    assert.equal(error.statusCode, 409)
    return true
  })
}

test('time off conflict: free inclusive date range can be saved and removed', async () => {
  await fixture(async (context) => {
    await save(context, timeOff('2030-01-09', '2030-01-11'))
    const saved = await pool.query(`
      SELECT start_date::text, end_date::text FROM employee_time_off WHERE employee_id = $1
    `, [context.employeeId])
    assert.deepEqual(saved.rows, [{ start_date: '2030-01-09', end_date: '2030-01-11' }])
    await save(context, [])
    const removed = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
    assert.equal(removed.rowCount, 0)
  })
})

for (const status of ['pending', 'confirmed']) {
  test(`time off conflict: ${status} appointment blocks absence`, async () => {
    await fixture(async (context) => {
      await appointment(context, '2030-01-09T09:00:00Z', '2030-01-09T09:30:00Z', status)
      await rejectConflict(save(context, timeOff('2030-01-08', '2030-01-09')))
      const saved = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
      assert.equal(saved.rowCount, 0)
    })
  })
}

test('time off conflict: cancelled completed and no-show appointments do not block absence', async () => {
  await fixture(async (context) => {
    for (const [index, status] of ['cancelled', 'completed', 'no_show'].entries()) {
      await appointment(context, `2030-01-09T${10 + index}:00:00Z`, `2030-01-09T${10 + index}:30:00Z`, status)
    }
    await save(context, timeOff())
    const saved = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
    assert.equal(saved.rowCount, 1)
  })
})

test('time off conflict: rejected combined edit preserves employee and previous schedule', async () => {
  await fixture(async (context) => {
    await save(context, timeOff('2030-01-12'))
    await appointment(context, '2030-01-09T09:00:00Z', '2030-01-09T09:30:00Z')
    await rejectConflict(save(context, timeOff(), { name: 'Must not persist', workingHours: [] }))
    const employee = await pool.query('SELECT name FROM employees WHERE id = $1', [context.employeeId])
    assert.equal(employee.rows[0].name, 'Schedule Lock Employee')
    const saved = await pool.query('SELECT start_date::text FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
    assert.deepEqual(saved.rows, [{ start_date: '2030-01-12' }])
    const hours = await pool.query('SELECT day_of_week FROM employee_working_hours WHERE employee_id = $1', [context.employeeId])
    assert.equal(hours.rowCount, 7)
  })
})

test('time off conflict: touching local midnight boundaries is allowed', async () => {
  await fixture(async (context) => {
    await appointment(context, '2030-01-09T22:30:00Z', '2030-01-09T23:00:00Z')
    await appointment(context, '2030-01-10T23:00:00Z', '2030-01-10T23:30:00Z')
    await save(context, timeOff('2030-01-10'))
  })
})

test('time off conflict: appointment crossing into the local day blocks absence', async () => {
  await fixture(async (context) => {
    await appointment(context, '2030-01-09T22:50:00Z', '2030-01-09T23:20:00Z')
    await rejectConflict(save(context, timeOff('2030-01-10')))
  })
})

test('time off conflict: spring DST day ends at the next local midnight', async () => {
  await fixture(async (context) => {
    await appointment(context, '2026-03-29T22:00:00Z', '2026-03-29T22:30:00Z')
    await save(context, timeOff('2026-03-29'))
  })
})

test('time off conflict: final hour of autumn DST day is included', async () => {
  await fixture(async (context) => {
    await appointment(context, '2026-10-25T22:15:00Z', '2026-10-25T22:45:00Z')
    await rejectConflict(save(context, timeOff('2026-10-25')))
  })
})

test('time off conflict: salon timezone determines the date instead of UTC', async () => {
  await fixture(async (context) => {
    await pool.query("UPDATE salons SET timezone = 'America/New_York' WHERE id = $1", [context.salonId])
    await appointment(context, '2030-01-10T02:00:00Z', '2030-01-10T02:30:00Z')
    await rejectConflict(save(context, timeOff('2030-01-09')))
  })
})

test('time off conflict: appointments of coworkers and other salons do not block absence', async () => {
  await fixture(async (context) => {
    await fixture(async (foreign) => {
      await appointment(foreign, '2030-01-09T09:00:00Z', '2030-01-09T09:30:00Z')
      const coworker = await pool.query(`
        INSERT INTO employees (salon_id, name) VALUES ($1, 'Other employee') RETURNING id
      `, [context.salonId])
      await pool.query(`
        INSERT INTO employee_services (employee_id, service_id, salon_id)
        VALUES ($1, $2, $3)
      `, [coworker.rows[0].id, context.input.service_id, context.salonId])
      await appointment({ ...context, employeeId: Number(coworker.rows[0].id) },
        '2030-01-09T09:00:00Z', '2030-01-09T09:30:00Z')
      await save(context, timeOff())
    })
  })
})

test('time off conflict: absence waits for booking and rejects after booking commits', async () => {
  await fixture(async (context) => {
    const db = await pool.connect()
    let pending
    try {
      await db.query('BEGIN')
      const pid = await db.query('SELECT pg_backend_pid() AS pid')
      const booking = await prepareAppointmentCreation(context.input, db)
      assert.equal(booking.error, undefined)
      pending = save(context, timeOff()).then(
        (result) => ({ result }),
        (error) => ({ error })
      )
      await waitForEmployeeLock(pid.rows[0].pid)
      await db.query('COMMIT')
      const outcome = await pending
      assert.equal(outcome.error?.code, 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT')
      assert.equal(outcome.error?.statusCode, 409)
      const saved = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employeeId])
      assert.equal(saved.rowCount, 0)
      const appointments = await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [context.salonId])
      assert.equal(appointments.rowCount, 1)
    } finally {
      await db.query('ROLLBACK')
      db.release()
      if (pending) await pending
    }
  })
})
