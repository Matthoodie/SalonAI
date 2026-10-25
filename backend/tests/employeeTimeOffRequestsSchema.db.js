import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pool from '../src/database/pool.js'

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

function insert(context, overrides = {}) {
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

test('time off request schema: pending request has no effect on actual time off', async () => {
  await fixture(async (context) => {
    const result = await insert(context)
    assert.equal(result.rows[0].status, 'pending')
    assert.equal(result.rows[0].decided_at, null)
    assert.equal(result.rows[0].withdrawn_at, null)
    const actual = await pool.query('SELECT id FROM employee_time_off WHERE employee_id = $1', [context.employees[0]])
    assert.equal(actual.rowCount, 0)
  })
})

test('time off request schema: approved and rejected decisions retain reviewer metadata', async () => {
  await fixture(async (context) => {
    for (const status of ['approved', 'rejected']) {
      const result = await insert(context, { ...decision(context, status), decision_note: 'Reviewed' })
      assert.equal(result.rows[0].status, status)
      assert.equal(Number(result.rows[0].decided_by_user_id), context.userIds[1])
      assert.equal(result.rows[0].decision_actor_role, 'owner')
      assert.equal(result.rows[0].decision_note, 'Reviewed')
    }
    await insert(context, { ...decision(context), decision_actor_role: 'admin' })
  })
})

test('time off request schema: withdrawn request has withdrawal time and no decision', async () => {
  await fixture(async (context) => {
    const result = await insert(context, { status: 'withdrawn', withdrawn_at: '2026-10-25T09:00:00Z' })
    assert.equal(result.rows[0].status, 'withdrawn')
    assert.equal(result.rows[0].decided_by_user_id, null)
    assert.ok(result.rows[0].withdrawn_at)
  })
})

test('time off request schema: incomplete or contradictory lifecycle metadata is rejected', async () => {
  await fixture(async (context) => {
    const invalid = [
      { status: 'approved' },
      { status: 'rejected' },
      { status: 'withdrawn' },
      { decided_by_user_id: context.userIds[1] },
      { decision_note: 'Pending cannot have a decision note' },
      { withdrawn_at: '2026-10-25T09:00:00Z' },
      { ...decision(context), decision_actor_role: null },
      { ...decision(context), decided_by_user_id: null },
      { ...decision(context), withdrawn_at: '2026-10-25T09:00:00Z' },
      { ...decision(context), status: 'withdrawn', withdrawn_at: '2026-10-25T09:00:00Z' },
    ]
    for (const data of invalid) await rejectsSql(insert(context, data), '23514')
  })
})

test('time off request schema: employee decision role and self-review are rejected', async () => {
  await fixture(async (context) => {
    await rejectsSql(insert(context, { ...decision(context), decision_actor_role: 'employee' }), '23514')
    await rejectsSql(insert(context, { ...decision(context), decided_by_user_id: context.userIds[0] }), '23514')
  })
})

test('time off request schema: invalid dates types statuses and nonfinite timestamps are rejected', async () => {
  await fixture(async (context) => {
    for (const data of [
      { start_date: '2030-01-11' },
      { end_date: 'infinity' },
      { start_date: '-infinity' },
      { type: 'unsupported' },
      { status: 'unsupported' },
      { created_at: 'infinity' },
      { ...decision(context), decided_at: 'infinity' },
      { ...decision(context), decided_at: '2026-10-25T07:00:00Z' },
      { status: 'withdrawn', withdrawn_at: 'infinity' },
      { status: 'withdrawn', withdrawn_at: '2026-10-25T07:00:00Z' },
    ]) await rejectsSql(insert(context, data), '23514')
  })
})

test('time off request schema: employee salon membership and requester identity must match', async () => {
  await fixture(async (context) => {
    await rejectsSql(insert(context, { employee_id: context.employees[1] }), '23503')
    await rejectsSql(insert(context, { requester_membership_id: context.memberships[1] }), '23503')
    await rejectsSql(insert(context, { requested_by_user_id: context.userIds[1] }), '23503')
  })
})

test('time off request schema: duplicate pending range is rejected regardless of type', async () => {
  await fixture(async (context) => {
    await insert(context)
    await rejectsSql(insert(context), '23505')
    await rejectsSql(insert(context, { type: 'personal' }), '23505')
    await insert(context, { start_date: '2030-01-11', end_date: '2030-01-11' })
  })
})

test('time off request schema: terminal state releases the pending range without deleting history', async () => {
  await fixture(async (context) => {
    const first = await insert(context)
    await pool.query(`
      UPDATE employee_time_off_requests
      SET status = 'withdrawn', withdrawn_at = '2026-10-25T09:00:00Z'
      WHERE id = $1
    `, [first.rows[0].id])
    const second = await insert(context)
    assert.notEqual(String(first.rows[0].id), String(second.rows[0].id))
    const saved = await pool.query(`
      SELECT status FROM employee_time_off_requests WHERE salon_id = $1 ORDER BY id
    `, [context.salonIds[0]])
    assert.deepEqual(saved.rows.map((item) => item.status), ['withdrawn', 'pending'])
  })
})

test('time off request schema: oversized notes are rejected', async () => {
  await fixture(async (context) => {
    await rejectsSql(insert(context, { note: 'x'.repeat(501) }), '22001')
    await rejectsSql(insert(context, { ...decision(context), decision_note: 'x'.repeat(501) }), '22001')
  })
})

test('time off request schema: concurrent duplicate inserts create one pending request', async () => {
  await fixture(async (context) => {
    const results = await Promise.allSettled([insert(context), insert(context)])
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1)
    const failures = results.filter((item) => item.status === 'rejected')
    assert.equal(failures.length, 1)
    assert.equal(failures[0].reason.code, '23505')
    const saved = await pool.query('SELECT id FROM employee_time_off_requests WHERE salon_id = $1', [context.salonIds[0]])
    assert.equal(saved.rowCount, 1)
  })
})
