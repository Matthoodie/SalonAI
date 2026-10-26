import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as pause } from 'node:timers/promises'
import { down as revertCancellation } from '../migrations/1793210400000_cancel-approved-time-off-requests.js'
import { randomUUID } from 'node:crypto'
import { prepareAppointmentCreation } from '../src/services/appointmentService.js'
import pool from '../src/database/pool.js'
import { createApp } from '../src/createApp.js'
import { createFixedTenantTestApp } from './helpers/fixedTenantTestApp.js'
import { submitEmployeeTimeOffRequest as submit, cancelEmployeeTimeOffRequest as cancel } from '../src/services/employeeTimeOffRequestService.js'

after(async () => { await pool.end() })
const base = '/api/time-off-requests'
const payload = { start_date: '2030-01-09', end_date: '2030-01-10', type: 'vacation', note: 'Holiday' }

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
      await pool.query('DELETE FROM employee_time_off WHERE employee_id IN (SELECT id FROM employees WHERE salon_id = ANY($1::bigint[]))', [salonIds])
      await pool.query('DELETE FROM employee_time_off_requests WHERE salon_id = ANY($1::bigint[])', [salonIds])
      await pool.query('DELETE FROM salons WHERE id = ANY($1::bigint[])', [salonIds])
    }
    if (userIds.length) await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds])
  }
}

async function pending(c, name = 'employee', extra = {}) {
  const actor = c[name]
  return (await submit({ salonId: actor.salonId, actorUserId: actor.userId,
    startDate: payload.start_date, endDate: payload.end_date, type: payload.type,
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
    VALUES ($1, $2, 'schedule.time_off', $3)
    ON CONFLICT (salon_id, role, permission_key) DO UPDATE SET permission_value = EXCLUDED.permission_value`,
  [c.salonId, role, value])
}
async function stored(c, request) {
  return (await pool.query('SELECT * FROM employee_time_off_requests WHERE salon_id = $1 AND id = $2', [c.salonId, request.id])).rows[0]
}
async function linked(request) {
  return (await pool.query('SELECT * FROM employee_time_off WHERE source_request_id = $1', [request.id])).rows
}

async function approved(c, extra = {}) {
  const request = await pending(c, 'employee', extra)
  return expectOK(await c.api('owner', `/${request.id}/decision`, 'POST', {
    decision: 'approved', decision_note: 'Original approval',
  })).request
}
const cancelBody = { cancellation_note: '  Plans changed  ' }
const doCancel = (c, request, name = 'owner', body = cancelBody) =>
  c.api(name, `/${request.id}/cancel`, 'POST', body)
const serviceCancel = (c, request, extra = {}) => cancel({ salonId: c.salonId,
  actorUserId: c.owner.userId, requestId: request.id, cancellationNote: 'Plans changed', ...extra })

for (const role of ['owner', 'admin']) {
  test(`cancellation: ${role} removes only linked absence and preserves approval audit`, async () => {
    await fixture(async c => {
      const request = await approved(c)
      const other = await pool.query(`INSERT INTO employee_time_off (employee_id, start_date, end_date, type)
        VALUES ($1, '2030-02-01', '2030-02-01', 'personal') RETURNING id`, [c.employee.employeeId])
      const row = expectOK(await doCancel(c, request, role))
      assert.equal(row.status, 'cancelled')
      assert.equal(row.cancellation_note, 'Plans changed')
      assert.equal(Number(row.cancelled_by_user_id), c[role].userId)
      assert.equal(row.cancellation_actor_role, role)
      assert.ok(new Date(row.cancelled_at) >= new Date(row.decided_at))
      for (const key of ['decided_at', 'decided_by_user_id', 'decision_actor_role', 'decision_note', 'start_date', 'end_date', 'type', 'note']) {
        assert.deepEqual(row[key], request[key], key)
      }
      assert.equal((await linked(request)).length, 0)
      assert.equal((await pool.query('SELECT id FROM employee_time_off WHERE id = $1', [other.rows[0].id])).rowCount, 1)
      const history = expectOK(await c.api('employee', '?status=cancelled'))
      assert.equal(history.length, 1)
      assert.equal(history[0].cancellation_note, 'Plans changed')
      assert.equal(expectOK(await c.api('employee', `/${request.id}`)).status, 'cancelled')
    })
  })
}

test('cancellation: employee cannot cancel even with direct permission and forged middleware role', async () => {
  await fixture(async c => {
    const request = await approved(c)
    await override(c, 'employee', 'direct')
    expectError(await c.api('employee', `/${request.id}/cancel`, 'POST', cancelBody, { role: 'owner' }), 403, 'TIME_OFF_CANCEL_FORBIDDEN')
    assert.equal((await linked(request)).length, 1)
  })
})
for (const access of ['deny', 'approval']) {
  test(`cancellation: admin permission ${access} blocks mutation`, async () => {
    await fixture(async c => {
      const request = await approved(c)
      await override(c, 'admin', access)
      expectError(await doCancel(c, request, 'admin'), 403, 'TIME_OFF_CANCEL_FORBIDDEN')
      assert.equal((await stored(c, request)).status, 'approved')
      assert.equal((await linked(request)).length, 1)
    })
  })
}
for (const target of ['membership', 'user', 'salon']) {
  test(`cancellation: inactive actor ${target} blocks stale context`, async () => {
    await fixture(async c => {
      const request = await approved(c)
      const [sql, key, code] = {
        membership: ['UPDATE salon_memberships SET active = false WHERE id = $1', c.admin.membershipId, 'TIME_OFF_ACTOR_FORBIDDEN'],
        user: ['UPDATE users SET active = false WHERE id = $1', c.admin.userId, 'TIME_OFF_ACTOR_FORBIDDEN'],
        salon: ['UPDATE salons SET active = false WHERE id = $1', c.salonId, 'TIME_OFF_SALON_UNAVAILABLE'],
      }[target]
      await pool.query(sql, [key])
      expectError(await doCancel(c, request, 'admin'), 403, code)
      assert.equal((await linked(request)).length, 1)
    })
  })
}
test('cancellation: promoted requester cannot cancel own approval', async () => {
  await fixture(async c => {
    const request = await approved(c)
    await pool.query("UPDATE salon_memberships SET role = 'admin' WHERE id = $1", [c.employee.membershipId])
    expectError(await doCancel(c, request, 'employee'), 403, 'TIME_OFF_SELF_CANCEL_FORBIDDEN')
    assert.equal((await linked(request)).length, 1)
  })
})
test('cancellation: current employee identity also prevents self cancellation', async () => {
  await fixture(async c => {
    const request = await approved(c)
    await pool.query("UPDATE salon_memberships SET employee_id = NULL, role = 'admin' WHERE id = $1", [c.employee.membershipId])
    await pool.query('UPDATE salon_memberships SET employee_id = $1 WHERE id = $2', [c.employee.employeeId, c.admin.membershipId])
    expectError(await doCancel(c, request, 'admin'), 403, 'TIME_OFF_SELF_CANCEL_FORBIDDEN')
    assert.equal((await linked(request)).length, 1)
  })
})
test('cancellation: foreign and missing request IDs are hidden', async () => {
  await fixture(async c => {
    const request = await pending(c, 'foreign')
    for (const id of [request.id, '9007199254740991']) {
      expectError(await c.api('owner', `/${id}/cancel`, 'POST', cancelBody), 404, 'TIME_OFF_REQUEST_NOT_FOUND')
    }
  })
})
test('cancellation: missing invalid overlong and forged bodies cannot mutate approval', async () => {
  await fixture(async c => {
    const request = await approved(c)
    for (const body of [undefined, [], { cancellation_note: 1 }, { cancellation_note: 'x'.repeat(501) },
      { cancellation_note: 'bad\0' }, { ...cancelBody, status: 'cancelled' },
      { ...cancelBody, cancelled_by_user_id: c.employee.userId }, { ...cancelBody, salon_id: c.foreignSalonId }]) {
      expectError(await c.api('owner', `/${request.id}/cancel`, 'POST', body), 400, 'TIME_OFF_INVALID_INPUT')
    }
    for (const cancellation_note of [undefined, null, '', ' \n\t ']) {
      expectError(await doCancel(c, request, 'owner', { cancellation_note }), 400, 'TIME_OFF_CANCELLATION_NOTE_REQUIRED')
    }
    assert.equal((await stored(c, request)).status, 'approved')
    assert.equal((await linked(request)).length, 1)
  })
})
test('cancellation: invalid ids and query authority are rejected', async () => {
  await fixture(async c => {
    const request = await approved(c)
    for (const id of ['0', '-1', '1e2', '9007199254740992']) {
      expectError(await c.api('owner', `/${id}/cancel`, 'POST', cancelBody), 400, 'TIME_OFF_INVALID_INPUT')
    }
    expectError(await c.api('owner', `/${request.id}/cancel?salon_id=${c.foreignSalonId}`, 'POST', cancelBody), 400, 'TIME_OFF_INVALID_INPUT')
    assert.equal((await linked(request)).length, 1)
  })
})
for (const status of ['pending', 'rejected', 'withdrawn']) {
  test(`cancellation: ${status} cannot be cancelled`, async () => {
    await fixture(async c => {
      const request = await pending(c)
      if (status === 'rejected') expectOK(await c.api('owner', `/${request.id}/decision`, 'POST', { decision: 'rejected' }))
      if (status === 'withdrawn') expectOK(await c.api('employee', `/${request.id}/withdraw`, 'POST'))
      expectError(await doCancel(c, request), 409, 'TIME_OFF_REQUEST_NOT_APPROVED')
      assert.equal((await stored(c, request)).status, status)
    })
  })
}
test('cancellation: cancelled cannot be cancelled again approved or withdrawn', async () => {
  await fixture(async c => {
    const request = await approved(c)
    const original = expectOK(await doCancel(c, request))
    expectError(await doCancel(c, request, 'admin', { cancellation_note: 'Overwrite' }), 409, 'TIME_OFF_REQUEST_NOT_APPROVED')
    expectError(await c.api('owner', `/${request.id}/decision`, 'POST', { decision: 'approved' }), 409, 'TIME_OFF_REQUEST_NOT_PENDING')
    expectError(await c.api('employee', `/${request.id}/withdraw`, 'POST'), 409, 'TIME_OFF_REQUEST_NOT_PENDING')
    const current = expectOK(await c.api('owner', `/${request.id}`))
    assert.equal(current.cancelled_at, original.cancelled_at)
    assert.equal(current.cancellation_note, original.cancellation_note)
    assert.equal((await linked(request)).length, 0)
  })
})
test('cancellation: simultaneous owner and admin requests have one winner', async () => {
  await fixture(async c => {
    const request = await approved(c)
    const results = await Promise.all([doCancel(c, request), doCancel(c, request, 'admin')])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
    expectError(results.find(result => result.status === 409), 409, 'TIME_OFF_REQUEST_NOT_APPROVED')
    assert.equal((await stored(c, request)).status, 'cancelled')
    assert.equal((await linked(request)).length, 0)
  })
})
test('cancellation: removal permits a new approval for the same dates', async () => {
  await fixture(async c => {
    const old = await approved(c)
    expectOK(await doCancel(c, old))
    const next = await approved(c)
    assert.notEqual(String(next.id), String(old.id))
    assert.equal((await linked(old)).length, 0)
    assert.equal((await linked(next)).length, 1)
  })
})
for (const target of ['membership', 'user', 'employee', 'link']) {
  test(`cancellation: unavailable requester ${target} does not prevent authorised cleanup`, async () => {
    await fixture(async c => {
      const request = await approved(c)
      const [sql, key] = {
        membership: ['UPDATE salon_memberships SET active = false WHERE id = $1', c.employee.membershipId],
        user: ['UPDATE users SET active = false WHERE id = $1', c.employee.userId],
        employee: ['UPDATE employees SET active = false WHERE id = $1', c.employee.employeeId],
        link: ["UPDATE salon_memberships SET employee_id = NULL, role = 'admin', active = false WHERE id = $1", c.employee.membershipId],
      }[target]
      await pool.query(sql, [key])
      expectOK(await doCancel(c, request))
      assert.equal((await linked(request)).length, 0)
    })
  })
}
test('cancellation: missing linked absence refuses to fabricate successful cancellation', async () => {
  await fixture(async c => {
    const request = await approved(c)
    await pool.query('DELETE FROM employee_time_off WHERE source_request_id = $1', [request.id])
    expectError(await doCancel(c, request), 409, 'TIME_OFF_SOURCE_INCONSISTENT')
    const row = await stored(c, request)
    assert.equal(row.status, 'approved')
    assert.equal(row.cancelled_at, null)
  })
})
test('cancellation: failed audit update rolls back the already deleted absence', async t => {
  await fixture(async c => {
    const request = await approved(c)
    const before = await linked(request)
    const realConnect = pool.connect.bind(pool)
    const injected = Object.assign(new Error('Injected cancellation update failure'), { code: 'TEST_CANCEL_UPDATE' })
    let deleteSeen = false
    const mock = t.mock.method(pool, 'connect', async () => {
      const db = await realConnect()
      return {
        async query(sql, values) {
          if (/SET status = 'cancelled'/.test(sql)) { assert.equal(deleteSeen, true); throw injected }
          const result = await db.query(sql, values)
          if (/DELETE FROM employee_time_off t/.test(sql)) deleteSeen = result.rowCount === 1
          return result
        },
        release(error) { db.release(error) },
      }
    })
    try { await assert.rejects(serviceCancel(c, request), error => error === injected) }
    finally { mock.mock.restore() }
    assert.equal(deleteSeen, true)
    assert.deepEqual(await linked(request), before)
    const row = await stored(c, request)
    assert.equal(row.status, 'approved')
    assert.equal(row.cancelled_at, null)
  })
})
test('cancellation: direct service validates reason and identifiers', async () => {
  await fixture(async c => {
    const request = await approved(c)
    for (const extra of [{ salonId: 0 }, { actorUserId: '1e2' }, { requestId: -1 }, { cancellationNote: 1 }]) {
      await assert.rejects(serviceCancel(c, request, extra), { code: 'TIME_OFF_INVALID_INPUT' })
    }
    await assert.rejects(serviceCancel(c, request, { cancellationNote: ' ' }), { code: 'TIME_OFF_CANCELLATION_NOTE_REQUIRED' })
    assert.equal((await linked(request)).length, 1)
  })
})
test('cancellation: authentication and private middleware protect the route', async () => {
  expectError(await fetchApp(createApp(), '/1/cancel', 'POST', cancelBody), 401, 'TIME_OFF_AUTH_REQUIRED')
  const app = createApp({ privateRouteMiddleware: [(_req, res) => res.status(401).json({ error: { code: 'TEST_AUTH_BLOCKED' } })] })
  expectError(await fetchApp(app, '/1/cancel', 'POST', cancelBody), 401, 'TEST_AUTH_BLOCKED')
})
test('cancellation: database requires audit fields and prevents linked cancelled absence', async () => {
  await fixture(async c => {
    const request = await approved(c)
    await assert.rejects(pool.query("UPDATE employee_time_off_requests SET cancelled_by_user_id = $1 WHERE id = $2", [c.owner.userId, request.id]), { code: '23514' })
    expectOK(await doCancel(c, request))
    for (const fragment of ['cancellation_note = NULL', "cancellation_note = ' '", 'cancelled_at = NULL',
      'cancellation_actor_role = NULL', "cancellation_actor_role = 'employee'", 'cancelled_by_user_id = requested_by_user_id',
      'decided_at = NULL']) {
      await assert.rejects(pool.query(`UPDATE employee_time_off_requests SET ${fragment} WHERE id = $1`, [request.id]), { code: '23514' })
    }
    await assert.rejects(pool.query(`INSERT INTO employee_time_off (employee_id, start_date, end_date, type, source_request_id)
      VALUES ($1, $2, $3, $4, $5)`, [request.employee_id, request.start_date, request.end_date, request.type, request.id]), { code: '23503' })
  })
})

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


test('cancellation: permission revocation committed ahead of the operation is enforced', async () => {
  await fixture(async c => {
    const request = await approved(c)
    await race(
      db => db.query('SELECT id FROM salons WHERE id = $1 FOR UPDATE', [c.salonId]),
      () => serviceCancel(c, request, { actorUserId: c.admin.userId }),
      db => db.query(`INSERT INTO salon_permission_overrides (salon_id, role, permission_key, permission_value)
        VALUES ($1, 'admin', 'schedule.time_off', 'deny')`, [c.salonId]),
      async result => {
        assert.equal(result.error?.code, 'TIME_OFF_CANCEL_FORBIDDEN')
        assert.equal((await linked(request)).length, 1)
        assert.equal((await stored(c, request)).status, 'approved')
      }
    )
  })
})
test('cancellation: employee lock serializes schedule writes before removing absence', async () => {
  await fixture(async c => {
    const request = await approved(c)
    await race(
      db => db.query('SELECT id FROM employees WHERE id = $1 FOR UPDATE', [c.employee.employeeId]),
      () => serviceCancel(c, request),
      async () => {
        assert.equal((await stored(c, request)).status, 'approved')
        assert.equal((await linked(request)).length, 1)
      },
      async result => {
        assert.equal(result.error, undefined)
        assert.equal(result.result.request.status, 'cancelled')
        assert.equal((await linked(request)).length, 0)
      }
    )
  })
})
test('cancellation: migration rollback refuses to erase cancellation history', async () => {
  await fixture(async c => {
    const request = await approved(c)
    expectOK(await doCancel(c, request))
    const statements = []
    revertCancellation({ sql: sql => statements.push(sql) })
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      await assert.rejects(db.query(statements.join('\n')), error => error.code === 'P0001' && error.message.includes('cancelled time-off requests exist'))
    } finally { await db.query('ROLLBACK'); db.release() }
    assert.equal((await stored(c, request)).status, 'cancelled')
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

test('cancellation: booking is blocked before cancellation and succeeds afterwards', async () => {
  await fixture(async c => {
    await setupBooking(c)
    const request = await approved(c)
    assert.ok((await prepareAppointmentCreation(c.booking)).error)
    expectOK(await doCancel(c, request))
    const result = await prepareAppointmentCreation(c.booking)
    assert.equal(result.error, undefined)
    assert.equal((await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [c.salonId])).rowCount, 1)
  })
})
test('cancellation: another independent absence still prevents booking', async () => {
  await fixture(async c => {
    await setupBooking(c)
    const request = await approved(c)
    await pool.query(`INSERT INTO employee_time_off (employee_id, start_date, end_date, type)
      VALUES ($1, '2030-01-09', '2030-01-09', 'personal')`, [c.employee.employeeId])
    expectOK(await doCancel(c, request))
    assert.ok((await prepareAppointmentCreation(c.booking)).error)
    assert.equal((await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [c.salonId])).rowCount, 0)
  })
})
