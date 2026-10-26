import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { updateEmployeeForSalon } from '../src/services/employeeService.js'
import { prepareAppointmentCreation } from '../src/services/appointmentService.js'
import { cancelEmployeeBlockedTimeRequest as cancel, decideEmployeeBlockedTimeRequest as decide } from '../src/services/employeeBlockedTimeRequestService.js'
import { setTimeout as pause } from 'node:timers/promises'
import pool from '../src/database/pool.js'
import { createApp } from '../src/createApp.js'
import { createFixedTenantTestApp } from './helpers/fixedTenantTestApp.js'
import { submitEmployeeBlockedTimeRequest as submit } from '../src/services/employeeBlockedTimeRequestService.js'

after(async () => { await pool.end() })
const base = '/api/blocked-time-requests'
const payload = { starts_at: '2030-01-09T09:00:00.000Z', ends_at: '2030-01-09T09:30:00.000Z', type: 'PRIVATE', note: 'Holiday' }

async function fetchApp(app, path = '', method = 'GET', body) {
  const server = app.listen(0, '127.0.0.1')
  try {
    await new Promise((resolve, reject) => {
      if (server.listening) resolve()
      else { server.once('listening', resolve); server.once('error', reject) }
    })
    const response = await fetch(`http://127.0.0.1:${server.address().port}${base}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() }
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
      server.closeAllConnections?.()
    })
  }
}

async function fixture(run) {
  const salonIds = []
  const userIds = []
  try {
    for (let index = 0; index < 2; index++) {
      const salon = await pool.query(`INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb') RETURNING id`, [`Request API ${randomUUID()}`])
      salonIds.push(Number(salon.rows[0].id))
    }
    const c = { salonId: salonIds[0], foreignSalonId: salonIds[1] }
    for (const name of ['owner', 'admin', 'employee', 'coworker', 'foreign']) {
      const token = randomUUID()
      const user = await pool.query(`INSERT INTO users (auth_provider, auth_subject, email, display_name)
        VALUES ('test', $1, $2, 'Request API user') RETURNING id`, [token, `${token}@example.test`])
      const userId = Number(user.rows[0].id)
      userIds.push(userId)
      const salonId = name === 'foreign' ? c.foreignSalonId : c.salonId
      const role = ['owner', 'admin'].includes(name) ? name : 'employee'
      let employeeId = null
      if (role === 'employee') {
        const employee = await pool.query(`INSERT INTO employees (salon_id, name)
          VALUES ($1, $2) RETURNING id`, [salonId, `API ${name}`])
        employeeId = Number(employee.rows[0].id)
      }
      const member = await pool.query(`INSERT INTO salon_memberships (salon_id, user_id, role, employee_id)
        VALUES ($1, $2, $3, $4) RETURNING id`, [salonId, userId, role, employeeId])
      c[name] = { userId, salonId, role, employeeId, membershipId: Number(member.rows[0].id) }
    }
    c.api = (name, path = '', method = 'GET', body, overrides = {}) => {
      const actor = { ...c[name], ...overrides }
      return fetchApp(createFixedTenantTestApp(actor.salonId, {
        role: actor.role, employeeId: actor.employeeId, userId: actor.userId,
      }), path, method, body)
    }
    await run(c)
  } finally {
    if (salonIds.length) {
      await pool.query('DELETE FROM appointments WHERE salon_id = ANY($1::bigint[])', [salonIds])
      await pool.query('DELETE FROM employee_blocked_times WHERE employee_id IN (SELECT id FROM employees WHERE salon_id = ANY($1::bigint[]))', [salonIds])
      await pool.query('DELETE FROM employee_blocked_time_requests WHERE salon_id = ANY($1::bigint[])', [salonIds])
      await pool.query('DELETE FROM salons WHERE id = ANY($1::bigint[])', [salonIds])
    }
    if (userIds.length) await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds])
  }
}

async function pending(c, name = 'employee', extra = {}) {
  const actor = c[name]
  return (await submit({ salonId: actor.salonId, actorUserId: actor.userId,
    startsAt: payload.starts_at, endsAt: payload.ends_at, type: payload.type,
    note: payload.note, ...extra })).request
}
function expectError(result, status, code) {
  assert.equal(result.status, status, JSON.stringify(result.body))
  assert.equal(result.body.error?.code, code)
}
function expectOK(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.body))
  assert.equal(result.cache, 'no-store')
  return result.body.data
}
async function override(c, role, value) {
  await pool.query(`INSERT INTO salon_permission_overrides (salon_id, role, permission_key, permission_value)
    VALUES ($1, $2, 'schedule.blocked_time', $3)
    ON CONFLICT (salon_id, role, permission_key) DO UPDATE SET permission_value = EXCLUDED.permission_value`,
  [c.salonId, role, value])
}
async function stored(c, request) {
  return (await pool.query('SELECT * FROM employee_blocked_time_requests WHERE salon_id = $1 AND id = $2', [c.salonId, request.id])).rows[0]
}
async function linked(request) {
  return (await pool.query('SELECT * FROM employee_blocked_times WHERE source_request_id = $1', [request.id])).rows
}

const approve = (c, row, name = 'owner') => c.api(name, `/${row.id}/decision`, 'POST', { decision: 'approved', decision_note: 'Agreed' })
const revoke = (c, row, name = 'owner') => c.api(name, `/${row.id}/cancel`, 'POST', { cancellation_note: 'Plans changed' })
const profile = (c, blockedTimes, extra = {}) => updateEmployeeForSalon({ salonId: c.salonId, employeeId: c.employee.employeeId, blockedTimes, ...extra })
const protectedPayload = row => ({ ...row, starts_at: new Date(row.starts_at).toISOString(), ends_at: new Date(row.ends_at).toISOString() })

test('blocked requests: creation uses authenticated identity and does not reserve interval', async () => {
  await fixture(async c => {
    const row = expectOK(await c.api('employee', '', 'POST', payload), 201)
    assert.equal(row.status, 'pending')
    assert.equal(Number(row.employee_id), c.employee.employeeId)
    assert.equal(row.starts_at, payload.starts_at)
    assert.equal(row.ends_at, payload.ends_at)
    assert.equal((await linked(row)).length, 0)
    expectError(await c.api('employee', '', 'POST', payload), 409, 'BLOCKED_TIME_REQUEST_DUPLICATE')
  })
})
test('blocked requests: validation rejects impossible dates ranges notes types and authority', async () => {
  await fixture(async c => {
    for (const body of [undefined, [], {}, { ...payload, starts_at: '2030-02-30T09:00:00Z' },
      { ...payload, starts_at: '2030-01-09T10:00:00+01:00' }, { ...payload, ends_at: payload.starts_at },
      { ...payload, ends_at: '2030-01-09T08:00:00Z' }, { ...payload, note: 'x'.repeat(251) },
      { ...payload, type: 'vacation' }, { ...payload, note: 'bad\0' },
      { ...payload, employee_id: c.coworker.employeeId }, { ...payload, status: 'approved' }]) {
      expectError(await c.api('employee', '', 'POST', body), 400, 'BLOCKED_TIME_INVALID_INPUT')
    }
    assert.equal((await pool.query('SELECT id FROM employee_blocked_time_requests WHERE salon_id = $1', [c.salonId])).rowCount, 0)
  })
})
test('blocked requests: self history and salon queue do not leak foreign records', async () => {
  await fixture(async c => {
    const own = await pending(c), other = await pending(c, 'coworker'), foreign = await pending(c, 'foreign')
    const mine = await c.api('employee')
    assert.deepEqual(expectOK(mine).map(r => String(r.id)), [String(own.id)])
    assert.equal(mine.body.meta.scope, 'self')
    const all = await c.api('owner')
    assert.deepEqual(expectOK(all).map(r => String(r.id)), [String(other.id), String(own.id)])
    assert.equal(all.body.meta.scope, 'salon')
    for (const id of [other.id, foreign.id, '9007199254740991']) expectError(await c.api('employee', `/${id}`), 404, 'BLOCKED_TIME_REQUEST_NOT_FOUND')
    expectError(await approve(c, foreign), 404, 'BLOCKED_TIME_REQUEST_NOT_FOUND')
    expectError(await revoke(c, foreign), 404, 'BLOCKED_TIME_REQUEST_NOT_FOUND')
  })
})
test('blocked requests: denial blocks submission but preserves history and withdrawal', async () => {
  await fixture(async c => {
    const row = await pending(c)
    await override(c, 'employee', 'deny')
    expectError(await c.api('employee', '', 'POST', payload), 403, 'SALON_PERMISSION_DENIED')
    assert.equal(expectOK(await c.api('employee')).length, 1)
    expectError(await c.api('owner', `/${row.id}/withdraw`, 'POST'), 404, 'BLOCKED_TIME_REQUEST_NOT_FOUND')
    assert.equal(expectOK(await c.api('employee', `/${row.id}/withdraw`, 'POST')).status, 'withdrawn')
    expectError(await approve(c, row), 409, 'BLOCKED_TIME_REQUEST_NOT_PENDING')
  })
})
for (const role of ['owner', 'admin']) {
  test(`blocked requests: ${role} approves and cancels with separate audit history`, async () => {
    await fixture(async c => {
      const row = await pending(c)
      const decision = expectOK(await approve(c, row, role))
      assert.equal(decision.request.status, 'approved')
      assert.equal(String(decision.blocked_time.source_request_id), String(row.id))
      assert.equal(decision.blocked_time.reason, payload.note)
      assert.equal((await linked(row)).length, 1)
      const cancelled = expectOK(await revoke(c, row, role))
      assert.equal(cancelled.status, 'cancelled')
      assert.equal(cancelled.decision_note, 'Agreed')
      assert.equal(cancelled.decided_at, decision.request.decided_at)
      assert.equal(Number(cancelled.cancelled_by_user_id), c[role].userId)
      assert.equal(cancelled.cancellation_note, 'Plans changed')
      assert.equal((await linked(row)).length, 0)
      const history = expectOK(await c.api('employee', '?status=cancelled'))
      assert.equal(history.length, 1)
      assert.equal(history[0].cancellation_note, 'Plans changed')
      expectError(await revoke(c, row), 409, 'BLOCKED_TIME_REQUEST_NOT_APPROVED')
      expectError(await approve(c, row), 409, 'BLOCKED_TIME_REQUEST_NOT_PENDING')
      const next = await pending(c)
      expectOK(await approve(c, next))
    })
  })
}
test('blocked requests: rejection records note without creating a block', async () => {
  await fixture(async c => {
    const row = await pending(c)
    const result = expectOK(await c.api('owner', `/${row.id}/decision`, 'POST', { decision: 'rejected', decision_note: 'x'.repeat(500) }))
    assert.equal(result.request.status, 'rejected')
    assert.equal(result.request.decision_note.length, 500)
    assert.equal(result.blocked_time, null)
    expectError(await revoke(c, row), 409, 'BLOCKED_TIME_REQUEST_NOT_APPROVED')
  })
})
test('blocked requests: employee direct grant still submits pending and never permits review', async () => {
  await fixture(async c => {
    await override(c, 'employee', 'direct')
    const own = expectOK(await c.api('employee', '', 'POST', payload), 201)
    assert.equal(own.status, 'pending')
    const other = await pending(c, 'coworker')
    expectError(await c.api('employee', `/${other.id}/decision`, 'POST', { decision: 'approved' }, { role: 'owner' }), 403, 'BLOCKED_TIME_REVIEW_FORBIDDEN')
    expectError(await revoke(c, other, 'employee'), 403, 'BLOCKED_TIME_CANCEL_FORBIDDEN')
  })
})
for (const access of ['deny', 'approval']) {
  test(`blocked requests: admin ${access} revokes review and cancellation`, async () => {
    await fixture(async c => {
      const row = await pending(c)
      expectOK(await approve(c, row))
      await override(c, 'admin', access)
      expectError(await approve(c, row, 'admin'), 403, 'BLOCKED_TIME_REVIEW_FORBIDDEN')
      expectError(await revoke(c, row, 'admin'), 403, 'BLOCKED_TIME_CANCEL_FORBIDDEN')
      const list = await c.api('admin'); assert.equal(list.body.meta.scope, 'self'); assert.equal(expectOK(list).length, 0)
    })
  })
}
test('blocked requests: promotion never permits self approval or cancellation', async () => {
  await fixture(async c => {
    const row = await pending(c)
    await pool.query("UPDATE salon_memberships SET role = 'admin' WHERE id = $1", [c.employee.membershipId])
    expectError(await approve(c, row, 'employee'), 403, 'BLOCKED_TIME_SELF_REVIEW_FORBIDDEN')
    expectOK(await approve(c, row))
    expectError(await revoke(c, row, 'employee'), 403, 'BLOCKED_TIME_SELF_CANCEL_FORBIDDEN')
  })
})
for (const target of ['membership', 'user', 'salon']) {
  test(`blocked requests: inactive ${target} defeats stale middleware`, async () => {
    await fixture(async c => {
      const row = await pending(c)
      const [sql, key, code] = {
        membership: ['UPDATE salon_memberships SET active = false WHERE id = $1', c.admin.membershipId, 'BLOCKED_TIME_ACTOR_FORBIDDEN'],
        user: ['UPDATE users SET active = false WHERE id = $1', c.admin.userId, 'BLOCKED_TIME_ACTOR_FORBIDDEN'],
        salon: ['UPDATE salons SET active = false WHERE id = $1', c.salonId, 'BLOCKED_TIME_SALON_UNAVAILABLE'],
      }[target]
      await pool.query(sql, [key])
      expectError(await approve(c, row, 'admin'), 403, code)
      expectError(await revoke(c, row, 'admin'), 403, code)
      expectError(await c.api('admin'), 403, code)
    })
  })
}
test('blocked requests: inactive requester blocks approval but allows rejection and cleanup', async () => {
  await fixture(async c => {
    const first = await pending(c)
    expectOK(await approve(c, first))
    const second = await pending(c, 'employee', { startsAt: '2030-01-10T09:00:00Z', endsAt: '2030-01-10T09:30:00Z' })
    await pool.query('UPDATE users SET active = false WHERE id = $1', [c.employee.userId])
    expectError(await approve(c, second), 409, 'BLOCKED_TIME_REQUESTER_UNAVAILABLE')
    expectOK(await c.api('owner', `/${second.id}/decision`, 'POST', { decision: 'rejected' }))
    expectOK(await revoke(c, first))
  })
})
test('blocked requests: cancellation requires a bounded reason and rejects authority fields', async () => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row))
    for (const body of [{}, { cancellation_note: ' ' }]) expectError(await c.api('owner', `/${row.id}/cancel`, 'POST', body), 400, 'BLOCKED_TIME_CANCELLATION_NOTE_REQUIRED')
    for (const body of [{ cancellation_note: 2 }, { cancellation_note: 'x'.repeat(501) }, { cancellation_note: 'ok', role: 'owner' }]) expectError(await c.api('owner', `/${row.id}/cancel`, 'POST', body), 400, 'BLOCKED_TIME_INVALID_INPUT')
    assert.equal((await linked(row)).length, 1)
  })
})
test('blocked requests: list validates filters and bounds pagination', async () => {
  await fixture(async c => {
    await pool.query(`INSERT INTO employee_blocked_time_requests
      (salon_id, employee_id, requester_membership_id, requested_by_user_id, starts_at, ends_at, type)
      SELECT $1, $2, $3, $4, timestamptz '2031-01-01T09:00:00Z' + day * interval '1 day',
        timestamptz '2031-01-01T09:30:00Z' + day * interval '1 day', 'BREAK'
      FROM generate_series(0, 54) AS day`, [c.salonId, c.employee.employeeId, c.employee.membershipId, c.employee.userId])
    const page = await c.api('employee', '?status=pending'); assert.equal(expectOK(page).length, 50)
    const next = await c.api('employee', `?before_id=${page.body.meta.next_before_id}`); assert.equal(expectOK(next).length, 5)
    assert.equal(new Set([...page.body.data, ...next.body.data].map(row => row.id)).size, 55)
    assert.equal(next.body.meta.next_before_id, null)
    for (const query of ['?status=all', '?status=pending&status=approved', '?before_id=0', '?scope=salon', '?salon_id=1']) expectError(await c.api('employee', query), 400, 'BLOCKED_TIME_INVALID_INPUT')
  })
})

async function setupBooking(c) {
    const client = await pool.query(`INSERT INTO clients
      (salon_id, name, phone_country_code, phone_number, phone_normalized)
      VALUES ($1, 'Request client', '+385', '911234567', '+385911234567') RETURNING id`, [c.salonId])
    const service = await pool.query(`INSERT INTO services
      (salon_id, name, category, price_cents, default_duration_minutes)
      VALUES ($1, 'Request service', 'Test', 3000, 30) RETURNING id`, [c.salonId])
    c.booking = { salon_id: c.salonId, employee_id: c.employee.employeeId,
      client_id: Number(client.rows[0].id), service_id: Number(service.rows[0].id),
      starts_at: '2030-01-09T09:00:00.000Z' }
    await pool.query(`INSERT INTO employee_services (employee_id, service_id, salon_id)
      VALUES ($1, $2, $3)`, [c.employee.employeeId, c.booking.service_id, c.salonId])
    await pool.query(`INSERT INTO employee_working_hours (employee_id, day_of_week, start_time, end_time)
      SELECT $1::bigint, day, '08:00'::time, '18:00'::time FROM generate_series(1, 7) AS day`, [c.employee.employeeId])
}

async function waitForLock(pid) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const result = await pool.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
      WHERE datname = current_database() AND $1::integer = ANY(pg_blocking_pids(pid))) AS waiting`, [pid])
    if (result.rows[0].waiting) return
    await pause(10)
  }
  assert.fail('Expected a competing operation to wait on the transaction lock.')
}
// Start a real competing service operation, prove it is waiting, then commit.
async function race(lock, start, beforeCommit, inspect) {
  const db = await pool.connect()
  let operation
  try {
    await db.query('BEGIN')
    const { rows: [{ pid }] } = await db.query('SELECT pg_backend_pid() AS pid')
    await lock(db)
    operation = start().then(result => ({ result }), error => ({ error }))
    await waitForLock(pid)
    await beforeCommit(db)
    await db.query('COMMIT')
    await inspect(await operation)
  } finally {
    await db.query('ROLLBACK')
    db.release()
    if (operation) await operation
  }
}


test('blocked requests: pending allows booking but approval then fails atomically', async () => {
  await fixture(async c => {
    await setupBooking(c); const row = await pending(c)
    assert.equal((await prepareAppointmentCreation(c.booking)).error, undefined)
    expectError(await approve(c, row), 409, 'EMPLOYEE_BLOCKED_TIME_APPOINTMENT_CONFLICT')
    assert.equal((await stored(c, row)).status, 'pending'); assert.equal((await linked(row)).length, 0)
  })
})
test('blocked requests: approved block prevents booking and cancellation releases it', async () => {
  await fixture(async c => {
    await setupBooking(c); const row = await pending(c); expectOK(await approve(c, row))
    assert.ok((await prepareAppointmentCreation(c.booking)).error)
    expectOK(await revoke(c, row))
    assert.equal((await prepareAppointmentCreation(c.booking)).error, undefined)
  })
})
test('blocked requests: existing manual block conflicts but adjacent intervals are allowed', async () => {
  await fixture(async c => {
    const row = await pending(c)
    await pool.query(`INSERT INTO employee_blocked_times (employee_id, starts_at, ends_at, type)
      VALUES ($1, $2, $3, 'BREAK')`, [c.employee.employeeId, payload.starts_at, payload.ends_at])
    expectError(await approve(c, row), 409, 'BLOCKED_TIME_EXISTING_ABSENCE_CONFLICT')
    const adjacent = await pending(c, 'employee', { startsAt: payload.ends_at, endsAt: '2030-01-09T10:00:00Z' })
    expectOK(await approve(c, adjacent))
  })
})
test('blocked requests: local-day absence blocks approval using salon timezone', async () => {
  await fixture(async c => {
    await pool.query("UPDATE salons SET timezone = 'America/New_York' WHERE id = $1", [c.salonId])
    await pool.query("INSERT INTO employee_time_off (employee_id, start_date, end_date, type) VALUES ($1, '2030-01-08', '2030-01-08', 'vacation')", [c.employee.employeeId])
    const row = await pending(c, 'employee', { startsAt: '2030-01-09T02:00:00Z', endsAt: '2030-01-09T02:30:00Z' })
    expectError(await approve(c, row), 409, 'BLOCKED_TIME_ABSENCE_CONFLICT')
    const boundary = await pending(c, 'employee', { startsAt: '2030-01-09T05:00:00Z', endsAt: '2030-01-09T05:30:00Z' })
    expectOK(await approve(c, boundary))
  })
})
test('blocked requests: concurrent decisions create one linked block', async () => {
  await fixture(async c => {
    const row = await pending(c)
    const results = await Promise.all([approve(c, row), approve(c, row, 'admin')])
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal((await linked(row)).length, 1)
  })
})
test('blocked requests: concurrent cancellations preserve one audit decision', async () => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row))
    const results = await Promise.all([revoke(c, row), revoke(c, row, 'admin')])
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal((await linked(row)).length, 0)
  })
})
test('blocked requests: permission revocation committed first is enforced after wait', async () => {
  await fixture(async c => {
    const row = await pending(c)
    await race(db => db.query('SELECT id FROM salons WHERE id = $1 FOR UPDATE', [c.salonId]),
      () => decide({ salonId: c.salonId, actorUserId: c.admin.userId, requestId: row.id, decision: 'approved' }),
      db => db.query("INSERT INTO salon_permission_overrides (salon_id, role, permission_key, permission_value) VALUES ($1, 'admin', 'schedule.blocked_time', 'deny')", [c.salonId]),
      async result => { assert.equal(result.error?.code, 'BLOCKED_TIME_REVIEW_FORBIDDEN'); assert.equal((await linked(row)).length, 0) })
  })
})
test('blocked requests: approval waits for booking and observes committed appointment', async () => {
  await fixture(async c => {
    await setupBooking(c); const row = await pending(c)
    await race(async db => { assert.equal((await prepareAppointmentCreation(c.booking, db)).error, undefined) },
      () => decide({ salonId: c.salonId, actorUserId: c.owner.userId, requestId: row.id, decision: 'approved' }),
      async () => {}, async result => { assert.equal(result.error?.code, 'EMPLOYEE_BLOCKED_TIME_APPOINTMENT_CONFLICT'); assert.equal((await linked(row)).length, 0) })
  })
})
test('blocked requests: failed linked insert rolls back approval', async t => {
  await fixture(async c => {
    const row = await pending(c), realConnect = pool.connect.bind(pool)
    const injected = Object.assign(new Error('test insert'), { code: 'TEST_INSERT' })
    const mock = t.mock.method(pool, 'connect', async () => { const db = await realConnect(); return {
      query(sql, values) { if (/INSERT INTO employee_blocked_times\s*\(/.test(sql)) throw injected; return db.query(sql, values) }, release(error) { db.release(error) },
    } })
    try { await assert.rejects(decide({ salonId: c.salonId, actorUserId: c.owner.userId, requestId: row.id, decision: 'approved' }), error => error === injected) }
    finally { mock.mock.restore() }
    assert.equal((await stored(c, row)).status, 'pending'); assert.equal((await linked(row)).length, 0)
  })
})
test('blocked requests: failed cancellation restores deleted source', async t => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row)); const before = await linked(row)
    const realConnect = pool.connect.bind(pool), injected = Object.assign(new Error('test update'), { code: 'TEST_UPDATE' })
    const mock = t.mock.method(pool, 'connect', async () => { const db = await realConnect(); return {
      query(sql, values) { if (/SET status = 'cancelled'/.test(sql)) throw injected; return db.query(sql, values) }, release(error) { db.release(error) },
    } })
    try { await assert.rejects(cancel({ salonId: c.salonId, actorUserId: c.owner.userId, requestId: row.id, cancellationNote: 'Changed' }), error => error === injected) }
    finally { mock.mock.restore() }
    assert.equal((await stored(c, row)).status, 'approved'); assert.deepEqual(await linked(row), before)
  })
})
test('blocked requests: profile preserves approved block id while editing other fields', async () => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row)); const before = await linked(row)
    await profile(c, before.map(protectedPayload), { name: 'Updated' })
    assert.deepEqual(await linked(row), before)
  })
})
test('blocked requests: profile cannot remove edit duplicate or forge a protected block', async () => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row)); const before = await linked(row), item = protectedPayload(before[0])
    for (const entries of [[], [{ ...item, reason: 'Changed' }], [item, item], [{ ...item, source_request_id: '999999' }], [{ ...item, ends_at: '2030-01-09T10:00:00Z' }]]) {
      await assert.rejects(profile(c, entries, { name: 'Must not persist' }), { code: 'APPROVED_BLOCKED_TIME_PROTECTED' })
      assert.deepEqual(await linked(row), before)
    }
    assert.equal((await pool.query('SELECT name FROM employees WHERE id = $1', [c.employee.employeeId])).rows[0].name, 'API employee')
  })
})
test('blocked requests: stale profile after cancellation cannot recreate approved block', async () => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row)); const stale = (await linked(row)).map(protectedPayload)
    expectOK(await revoke(c, row))
    await assert.rejects(profile(c, stale), { code: 'APPROVED_BLOCKED_TIME_PROTECTED' })
    assert.equal((await linked(row)).length, 0)
  })
})
test('blocked requests: manual blocks can change alongside protected block', async () => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row)); const source = (await linked(row)).map(protectedPayload)
    await profile(c, [...source, { starts_at: '2030-01-10T09:00:00Z', ends_at: '2030-01-10T09:30:00Z', type: 'BREAK', reason: 'Manual' }])
    assert.equal((await pool.query('SELECT id FROM employee_blocked_times WHERE employee_id = $1', [c.employee.employeeId])).rowCount, 2)
    await profile(c, source)
    assert.equal((await pool.query('SELECT id FROM employee_blocked_times WHERE employee_id = $1', [c.employee.employeeId])).rowCount, 1)
  })
})
test('blocked requests: database links only matching approved requests and requires audit', async () => {
  await fixture(async c => {
    const row = await pending(c)
    const insert = () => pool.query(`INSERT INTO employee_blocked_times (employee_id, starts_at, ends_at, type, source_request_id)
      VALUES ($1, $2, $3, $4, $5)`, [c.employee.employeeId, payload.starts_at, payload.ends_at, payload.type, row.id])
    await assert.rejects(insert(), { code: '23503' })
    expectOK(await approve(c, row)); expectOK(await revoke(c, row))
    await assert.rejects(insert(), { code: '23503' })
    await assert.rejects(pool.query('UPDATE employee_blocked_time_requests SET cancellation_note = NULL WHERE id = $1', [row.id]), { code: '23514' })
  })
})
test('blocked requests: all routes require authentication and private middleware', async () => {
  const app = createApp({ privateRouteMiddleware: [(_req, res) => res.status(401).json({ error: { code: 'TEST_AUTH_BLOCKED' } })] })
  for (const [path, method, body] of [['', 'GET'], ['/1', 'GET'], ['', 'POST', payload], ['/1/withdraw', 'POST'], ['/1/decision', 'POST', { decision: 'approved' }], ['/1/cancel', 'POST', { cancellation_note: 'Changed' }]]) {
    expectError(await fetchApp(createApp(), path, method, body), 401, 'BLOCKED_TIME_AUTH_REQUIRED')
    expectError(await fetchApp(app, path, method, body), 401, 'TEST_AUTH_BLOCKED')
  }
})

test('blocked requests: manual overlap with protected block is rejected', async () => {
  await fixture(async c => {
    const row = await pending(c); expectOK(await approve(c, row))
    const source = (await linked(row)).map(protectedPayload)
    await assert.rejects(profile(c, [...source, { starts_at: payload.starts_at, ends_at: payload.ends_at, type: 'BREAK', reason: 'Duplicate' }]), { code: 'APPROVED_BLOCKED_TIME_CONFLICT' })
    assert.equal((await linked(row)).length, 1)
  })
})
