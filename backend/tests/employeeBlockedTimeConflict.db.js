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
    `, [`Blocked Time Lock ${Date.now()}-${process.pid}`])
    salonId = Number(salon.rows[0].id)

    const employee = await pool.query(`
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Blocked Time Lock Employee') RETURNING id
    `, [salonId])
    const employeeId = Number(employee.rows[0].id)

    const client = await pool.query(`
      INSERT INTO clients (
        salon_id, name, phone_country_code,
        phone_number, phone_normalized
      ) VALUES ($1, 'Blocked Time Lock Client', '+385', '911234567', '+385911234567')
      RETURNING id
    `, [salonId])

    const service = await pool.query(`
      INSERT INTO services (
        salon_id, name, category, price_cents, default_duration_minutes
      ) VALUES ($1, 'Blocked Time Lock Service', 'Test', 3000, 30)
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

function block(start = '2030-01-09T09:00:00.000Z', end = '2030-01-09T09:30:00.000Z') {
  return { starts_at: start, ends_at: end, type: 'BREAK', reason: 'Pause' }
}
function save(c, entries, extra = {}) {
  return updateEmployeeForSalon({ salonId: c.salonId, employeeId: c.employeeId,
    blockedTimes: entries, ...extra })
}
async function blocks(c) {
  return (await pool.query('SELECT * FROM employee_blocked_times WHERE employee_id = $1 ORDER BY id', [c.employeeId])).rows
}
async function rejectConflict(operation) {
  await assert.rejects(operation, error => error.code === 'EMPLOYEE_BLOCKED_TIME_APPOINTMENT_CONFLICT' && error.statusCode === 409)
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


test('blocked time: free range saves and can be removed', async () => {
  await fixture(async c => {
    await save(c, [block()])
    const rows = await blocks(c)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].starts_at.toISOString(), block().starts_at)
    assert.equal(rows[0].ends_at.toISOString(), block().ends_at)
    assert.equal(rows[0].type, 'BREAK')
    assert.equal(rows[0].reason, 'Pause')
    await save(c, [])
    assert.equal((await blocks(c)).length, 0)
  })
})
for (const status of ['pending', 'confirmed']) {
  test(`blocked time: ${status} appointment prevents saving`, async () => {
    await fixture(async c => {
      await appointment(c, block().starts_at, block().ends_at, status)
      await rejectConflict(save(c, [block()]))
      assert.equal((await blocks(c)).length, 0)
    })
  })
}
for (const status of ['cancelled', 'completed', 'no_show']) {
  test(`blocked time: ${status} appointment does not prevent saving`, async () => {
    await fixture(async c => {
      await appointment(c, block().starts_at, block().ends_at, status)
      await save(c, [block()])
      assert.equal((await blocks(c)).length, 1)
    })
  })
}
for (const [name, start, end] of [
  ['starts within appointment', '2030-01-09T09:15:00.000Z', '2030-01-09T10:00:00.000Z'],
  ['ends within appointment', '2030-01-09T08:30:00.000Z', '2030-01-09T09:15:00.000Z'],
  ['contains appointment', '2030-01-09T08:30:00.000Z', '2030-01-09T10:00:00.000Z'],
  ['inside appointment', '2030-01-09T09:10:00.000Z', '2030-01-09T09:20:00.000Z'],
]) {
  test(`blocked time: ${name} is a conflict`, async () => {
    await fixture(async c => {
      await appointment(c, block().starts_at, block().ends_at)
      await rejectConflict(save(c, [block(start, end)]))
    })
  })
}
test('blocked time: exact touching boundaries are allowed on both sides', async () => {
  await fixture(async c => {
    await appointment(c, block().starts_at, block().ends_at)
    await save(c, [block('2030-01-09T08:30:00.000Z', block().starts_at),
      block(block().ends_at, '2030-01-09T10:00:00.000Z')])
    assert.equal((await blocks(c)).length, 2)
  })
})
test('blocked time: one conflicting entry rejects the entire replacement and profile edit', async () => {
  await fixture(async c => {
    await save(c, [block('2030-01-10T09:00:00.000Z', '2030-01-10T09:30:00.000Z')])
    const before = await blocks(c)
    await appointment(c, block().starts_at, block().ends_at)
    await rejectConflict(save(c, [block('2030-01-11T09:00:00.000Z', '2030-01-11T09:30:00.000Z'), block()],
      { name: 'Must not persist', active: false, workingHours: [], dateOverrides: [], timeOff: [{ start_date: '2030-01-12', end_date: '2030-01-12', type: 'vacation' }] }))
    assert.deepEqual(await blocks(c), before)
    const employee = (await pool.query('SELECT name, active FROM employees WHERE id = $1', [c.employeeId])).rows[0]
    assert.equal(employee.name, 'Blocked Time Lock Employee')
    assert.equal(employee.active, true)
    assert.equal((await pool.query('SELECT day_of_week FROM employee_working_hours WHERE employee_id = $1', [c.employeeId])).rowCount, 7)
    assert.equal((await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [c.employeeId])).rowCount, 0)
  })
})
test('blocked time: omitting blocks preserves them and does not block unrelated profile edit', async () => {
  await fixture(async c => {
    await save(c, [block()])
    const before = await blocks(c)
    // Represents an old inconsistent record predating this validation.
    await appointment(c, block().starts_at, block().ends_at)
    await save(c, undefined, { name: 'Updated' })
    assert.deepEqual(await blocks(c), before)
    await save(c, [])
    assert.equal((await blocks(c)).length, 0)
  })
})
test('blocked time: foreign employee id is rejected without changing either schedule', async () => {
  await fixture(async c => {
    await fixture(async foreign => {
      await assert.rejects(save(c, [block()], { employeeId: foreign.employeeId }), { code: 'EMPLOYEE_NOT_FOUND' })
      assert.equal((await blocks(c)).length, 0)
      assert.equal((await blocks(foreign)).length, 0)
    })
  })
})
test('blocked time: coworkers and other salons do not cause false conflicts', async () => {
  await fixture(async c => {
    await fixture(async foreign => {
      await appointment(foreign, block().starts_at, block().ends_at)
      const coworker = (await pool.query("INSERT INTO employees (salon_id, name) VALUES ($1, 'Coworker') RETURNING id", [c.salonId])).rows[0]
      await pool.query('INSERT INTO employee_services (employee_id, service_id, salon_id) VALUES ($1, $2, $3)', [coworker.id, c.input.service_id, c.salonId])
      await appointment({ ...c, employeeId: Number(coworker.id) }, block().starts_at, block().ends_at)
      await save(c, [block()])
      assert.equal((await blocks(c)).length, 1)
    })
  })
})
test('blocked time: UTC range across midnight conflicts regardless of salon timezone', async () => {
  await fixture(async c => {
    await pool.query("UPDATE salons SET timezone = 'America/New_York' WHERE id = $1", [c.salonId])
    await appointment(c, '2030-01-09T23:50:00Z', '2030-01-10T00:20:00Z')
    await rejectConflict(save(c, [block('2030-01-10T00:00:00.000Z', '2030-01-10T00:30:00.000Z')]))
  })
})
test('blocked time: repeated autumn local hour is compared as distinct UTC instants', async () => {
  await fixture(async c => {
    await appointment(c, '2026-10-25T00:00:00Z', '2026-10-25T00:30:00Z')
    await save(c, [block('2026-10-25T01:00:00.000Z', '2026-10-25T01:30:00.000Z')])
    await rejectConflict(save(c, [block('2026-10-25T00:15:00.000Z', '2026-10-25T00:45:00.000Z')]))
  })
})
test('blocked time: invalid intervals and types are rejected before replacing saved data', async () => {
  await fixture(async c => {
    await save(c, [block()])
    const before = await blocks(c)
    for (const entry of [{ ...block(), starts_at: 'invalid' }, { ...block(), ends_at: block().starts_at },
      { ...block(), ends_at: '2030-01-09T08:00:00.000Z' }, { ...block(), type: 'vacation' }]) {
      await assert.rejects(save(c, [entry]), { code: 'VALIDATION_ERROR' })
      assert.deepEqual(await blocks(c), before)
    }
  })
})
test('blocked time: saved block prevents a subsequent booking', async () => {
  await fixture(async c => {
    await save(c, [block()])
    assert.ok((await prepareAppointmentCreation(c.input)).error)
    assert.equal((await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [c.salonId])).rowCount, 0)
  })
})
test('blocked time: waits for concurrent booking and refuses conflict after commit', async () => {
  await fixture(async c => {
    const db = await pool.connect()
    let pending
    try {
      await db.query('BEGIN')
      const pid = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
      assert.equal((await prepareAppointmentCreation(c.input, db)).error, undefined)
      pending = save(c, [block()]).then(result => ({ result }), error => ({ error }))
      await waitForEmployeeLock(pid)
      await db.query('COMMIT')
      assert.equal((await pending).error?.code, 'EMPLOYEE_BLOCKED_TIME_APPOINTMENT_CONFLICT')
      assert.equal((await blocks(c)).length, 0)
      assert.equal((await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [c.salonId])).rowCount, 1)
    } finally {
      await db.query('ROLLBACK'); db.release()
      if (pending) await pending
    }
  })
})
test('blocked time: waiting booking observes a block committed under the employee lock', async () => {
  await fixture(async c => {
    const db = await pool.connect()
    let pending
    try {
      await db.query('BEGIN')
      const pid = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
      await db.query('SELECT id FROM employees WHERE id = $1 AND salon_id = $2 FOR UPDATE', [c.employeeId, c.salonId])
      await db.query(`INSERT INTO employee_blocked_times (employee_id, starts_at, ends_at, type)
        VALUES ($1, $2, $3, 'BREAK')`, [c.employeeId, block().starts_at, block().ends_at])
      pending = prepareAppointmentCreation(c.input).then(result => ({ result }), error => ({ error }))
      await waitForEmployeeLock(pid)
      await db.query('COMMIT')
      const outcome = await pending
      assert.equal(outcome.error, undefined)
      assert.ok(outcome.result.error)
      assert.equal((await blocks(c)).length, 1)
      assert.equal((await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [c.salonId])).rowCount, 0)
    } finally {
      await db.query('ROLLBACK'); db.release()
      if (pending) await pending
    }
  })
})
