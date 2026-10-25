import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pool from '../src/database/pool.js'
import { setTimeout as pause } from 'node:timers/promises'
import { updateEmployeeForSalon } from '../src/services/employeeService.js'

after(async () => { await pool.end() })

async function fixture(run) {
  const salonIds = []
  const userIds = []
  const context = { employees: [], memberships: [] }
  try {
    for (let i = 0; i < 2; i += 1) {
      const token = randomUUID()
      const salon = await pool.query(`
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb') RETURNING id
      `, [`Time off requests ${token}`])
      const salonId = Number(salon.rows[0].id)
      salonIds.push(salonId)
      const user = await pool.query(`
        INSERT INTO users (auth_provider, auth_subject, email, display_name)
        VALUES ('test', $1, $2, 'Time off request test') RETURNING id
      `, [token, `${token}@example.test`])
      const userId = Number(user.rows[0].id)
      userIds.push(userId)
      const employee = await pool.query(`
        INSERT INTO employees (salon_id, name) VALUES ($1, 'Request employee') RETURNING id
      `, [salonId])
      const employeeId = Number(employee.rows[0].id)
      context.employees.push(employeeId)
      const membership = await pool.query(`
        INSERT INTO salon_memberships (user_id, salon_id, role, employee_id)
        VALUES ($1, $2, 'employee', $3) RETURNING id
      `, [userId, salonId, employeeId])
      context.memberships.push(Number(membership.rows[0].id))
    }
    // Real authorization is checked by the future service; this gives the
    // schema fixture a reviewer who also belongs to the selected salon.
    await pool.query(`
      INSERT INTO salon_memberships (user_id, salon_id, role)
      VALUES ($1, $2, 'owner')
    `, [userIds[1], salonIds[0]])
    await run({ ...context, salonIds, userIds })
  } finally {
    if (salonIds.length) {
      await pool.query('DELETE FROM employee_time_off WHERE employee_id IN (SELECT id FROM employees WHERE salon_id = ANY($1::bigint[]))', [salonIds])
      await pool.query('DELETE FROM employee_time_off_requests WHERE salon_id = ANY($1::bigint[])', [salonIds])
      await pool.query('DELETE FROM salons WHERE id = ANY($1::bigint[])', [salonIds])
    }
    if (userIds.length) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds])
    }
  }
}

function row(context, overrides = {}) {
  return {
    salon_id: context.salonIds[0],
    employee_id: context.employees[0],
    requester_membership_id: context.memberships[0],
    requested_by_user_id: context.userIds[0],
    start_date: '2030-01-09',
    end_date: '2030-01-10',
    type: 'vacation',
    created_at: '2026-10-25T08:00:00Z',
    ...overrides,
  }
}

function insertRequest(context, overrides = {}) {
  const data = row(context, overrides)
  const keys = Object.keys(data)
  // Keys are fixed, test-owned identifiers. Values always use parameters.
  return pool.query(`
    INSERT INTO employee_time_off_requests (${keys.join(', ')})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
    RETURNING *
  `, Object.values(data))
}

function decision(context, status = 'approved') {
  return {
    status,
    decided_at: '2026-10-25T09:00:00Z',
    decided_by_user_id: context.userIds[1],
    decision_actor_role: 'owner',
  }
}

async function rejectsSql(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, code)
    return true
  })
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

function entry(overrides = {}) {
  return { start_date: '2030-01-09', end_date: '2030-01-10', type: 'vacation', note: null, ...overrides }
}

async function link(context, requestId, overrides = {}, db = pool) {
  const data = { employee_id: context.employees[0], ...entry(), source_request_id: requestId, ...overrides }
  const keys = Object.keys(data)
  return db.query(`
    INSERT INTO employee_time_off (${keys.join(', ')})
    VALUES (${keys.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *
  `, Object.values(data))
}

async function approved(context, overrides = {}) {
  const request = await insertRequest(context, { ...decision(context), ...overrides })
  const result = await link(context, request.rows[0].id, overrides)
  return { requestId: request.rows[0].id, timeOffId: result.rows[0].id }
}

function save(context, overrides) {
  return updateEmployeeForSalon({ salonId: context.salonIds[0], employeeId: context.employees[0], ...overrides })
}

async function savedRows(context) {
  const result = await pool.query(`
    SELECT id::text, source_request_id::text, start_date::text, end_date::text, type, note
    FROM employee_time_off WHERE employee_id = $1 ORDER BY id
  `, [context.employees[0]])
  return result.rows
}

async function rejectedSave(context, data, code = 'APPROVED_TIME_OFF_PROTECTED', status = 409) {
  await assert.rejects(save(context, data), (error) => {
    assert.equal(error.code, code)
    assert.equal(error.statusCode, status)
    return true
  })
}

test('approved absence: manual rows remain valid without a source request', async () => {
  await fixture(async (context) => {
    const result = await link(context, null)
    assert.equal(result.rows[0].source_request_id, null)
    assert.equal(result.rows[0].source_request_status, null)
  })
})

test('approved absence: matching approved request can create one linked absence', async () => {
  await fixture(async (context) => {
    const result = await approved(context)
    const saved = await savedRows(context)
    assert.equal(saved.length, 1)
    assert.equal(saved[0].source_request_id, String(result.requestId))
    await rejectsSql(link(context, result.requestId), '23505')
  })
})

test('approved absence: pending rejected and withdrawn requests cannot be linked', async () => {
  await fixture(async (context) => {
    for (const data of [
      {}, decision(context, 'rejected'),
      { status: 'withdrawn', withdrawn_at: '2026-10-25T09:00:00Z' },
    ]) {
      const request = await insertRequest(context, data)
      await rejectsSql(link(context, request.rows[0].id), '23503')
    }
  })
})

test('approved absence: employee dates and type must match the approved request', async () => {
  await fixture(async (context) => {
    const request = await insertRequest(context, decision(context))
    for (const data of [
      { employee_id: context.employees[1] },
      { start_date: '2030-01-08' },
      { end_date: '2030-01-11' },
      { type: 'personal' },
    ]) await rejectsSql(link(context, request.rows[0].id, data), '23503')
  })
})

test('approved absence: linked source cannot be deleted or have its dates changed', async () => {
  await fixture(async (context) => {
    const result = await approved(context)

    await rejectsSql(
      pool.query(
        'DELETE FROM employee_time_off_requests WHERE id = $1',
        [result.requestId]
      ),
      '23001'
    )

    await rejectsSql(
      pool.query(
        "UPDATE employee_time_off_requests SET end_date = '2030-01-11' WHERE id = $1",
        [result.requestId]
      ),
      '23001'
    )

    await rejectsSql(
      pool.query(
        "UPDATE employee_time_off SET end_date = '2030-01-11' WHERE id = $1",
        [result.timeOffId]
      ),
      '23503'
    )
  })
})

test('approved absence: legacy form preserves approved ID and replaces only manual rows', async () => {
  await fixture(async (context) => {
    const result = await approved(context)
    await link(context, null, { start_date: '2030-01-12', end_date: '2030-01-12' })
    const manual = entry({ start_date: '2030-01-15', end_date: '2030-01-15', type: 'personal' })
    await save(context, { name: 'Updated employee', timeOff: [manual, entry({ note: '' })] })
    const saved = await savedRows(context)
    assert.equal(saved.length, 2)
    const protectedRow = saved.find((item) => item.source_request_id !== null)
    assert.equal(protectedRow.id, String(result.timeOffId))
    assert.equal(protectedRow.source_request_id, String(result.requestId))
    assert.equal(protectedRow.note, null)
    const manualRow = saved.find((item) => item.source_request_id === null)
    assert.equal(manualRow.start_date, '2030-01-15')
    assert.equal(manualRow.type, 'personal')
    const employee = await pool.query('SELECT name FROM employees WHERE id = $1', [context.employees[0]])
    assert.equal(employee.rows[0].name, 'Updated employee')
    await save(context, { timeOff: [entry()] })
    const afterRemoval = await savedRows(context)
    assert.equal(afterRemoval.length, 1)
    assert.equal(afterRemoval[0].id, String(result.timeOffId))
  })
})

test('approved absence: omitted approved row rejects the whole combined edit', async () => {
  await fixture(async (context) => {
    await approved(context)
    await link(context, null, { start_date: '2030-01-12', end_date: '2030-01-12' })
    const before = await savedRows(context)
    await rejectedSave(context, { name: 'Must not persist', timeOff: [] })
    assert.deepEqual(await savedRows(context), before)
    const employee = await pool.query('SELECT name FROM employees WHERE id = $1', [context.employees[0]])
    assert.equal(employee.rows[0].name, 'Request employee')
  })
})

test('approved absence: changing approved dates type or note through the employee form is rejected', async () => {
  await fixture(async (context) => {
    await approved(context, { note: 'Approved note' })
    const before = await savedRows(context)
    for (const changes of [
      { start_date: '2030-01-08' },
      { end_date: '2030-01-11' },
      { type: 'personal' },
      { note: 'Changed note' },
    ]) {
      await rejectedSave(context, { timeOff: [entry({ note: 'Approved note', ...changes })] })
      assert.deepEqual(await savedRows(context), before)
    }
  })
})

test('approved absence: duplicate submitted approved row is rejected without duplication', async () => {
  await fixture(async (context) => {
    await approved(context)
    const before = await savedRows(context)
    await rejectedSave(context, { timeOff: [entry(), entry()] }, 'APPROVED_TIME_OFF_DUPLICATED', 400)
    assert.deepEqual(await savedRows(context), before)
  })
})

test('approved absence: name-only edit leaves all absence rows untouched', async () => {
  await fixture(async (context) => {
    await approved(context)
    const before = await savedRows(context)
    await save(context, { name: 'Name only' })
    assert.deepEqual(await savedRows(context), before)
    const employee = await pool.query('SELECT name FROM employees WHERE id = $1', [context.employees[0]])
    assert.equal(employee.rows[0].name, 'Name only')
  })
})

test('approved absence: manual-only replacement and removal still work', async () => {
  await fixture(async (context) => {
    await save(context, { timeOff: [entry()] })
    await save(context, { timeOff: [entry({ type: 'personal' })] })
    const rows = await savedRows(context)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].type, 'personal')
    assert.equal(rows[0].source_request_id, null)
    await save(context, { timeOff: [] })
    assert.deepEqual(await savedRows(context), [])
  })
})

test('approved absence: client-supplied source ID cannot link a foreign request', async () => {
  await fixture(async (context) => {
    const protectedEntry = await approved(context)
    const before = await savedRows(context)
    const other = { ...context, salonIds: [context.salonIds[1]], employees: [context.employees[1]] }
    await save(other, { timeOff: [entry({ source_request_id: protectedEntry.requestId })] })
    const foreignRows = await savedRows(other)
    assert.equal(foreignRows.length, 1)
    assert.equal(foreignRows[0].source_request_id, null)
    assert.deepEqual(await savedRows(context), before)
  })
})

test('approved absence: stale form waits for approval write and cannot remove the new linked row', async () => {
  await fixture(async (context) => {
    const db = await pool.connect()
    let pending
    try {
      const request = await insertRequest(context, decision(context))
      await db.query('BEGIN')
      const pid = await db.query('SELECT pg_backend_pid() AS pid')
      await db.query('SELECT id FROM employees WHERE id = $1 AND salon_id = $2 FOR UPDATE', [context.employees[0], context.salonIds[0]])
      pending = save(context, { name: 'Stale edit', timeOff: [] }).then(
        (result) => ({ result }), (error) => ({ error })
      )
      await waitForEmployeeLock(pid.rows[0].pid)
      const added = await link(context, request.rows[0].id, {}, db)
      await db.query('COMMIT')
      const outcome = await pending
      assert.equal(outcome.error?.code, 'APPROVED_TIME_OFF_PROTECTED')
      const saved = await savedRows(context)
      assert.equal(saved.length, 1)
      assert.equal(saved[0].id, String(added.rows[0].id))
      const employee = await pool.query('SELECT name FROM employees WHERE id = $1', [context.employees[0]])
      assert.equal(employee.rows[0].name, 'Request employee')
    } finally {
      await db.query('ROLLBACK')
      db.release()
      if (pending) await pending
    }
  })
})
