import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pool from '../src/database/pool.js'
import { createApp } from '../src/createApp.js'
import { createFixedTenantTestApp } from './helpers/fixedTenantTestApp.js'
import { submitEmployeeTimeOffRequest as submit } from '../src/services/employeeTimeOffRequestService.js'

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

test('time off API: POST creates pending request using authenticated identity', async () => {
  await fixture(async c => {
    const request = expectOK(await c.api('employee', '', 'POST', payload), 201)
    assert.equal(request.status, 'pending')
    assert.equal(Number(request.salon_id), c.salonId)
    assert.equal(Number(request.requested_by_user_id), c.employee.userId)
    assert.equal(Number(request.employee_id), c.employee.employeeId)
    assert.equal(request.start_date, payload.start_date)
    assert.equal(request.end_date, payload.end_date)
    assert.equal((await linked(request)).length, 0)
  })
})

test('time off API: employee list contains only own submitted requests', async () => {
  await fixture(async c => {
    const own = await pending(c)
    await pending(c, 'coworker')
    await pending(c, 'foreign')
    const response = await c.api('employee')
    const rows = expectOK(response)
    assert.deepEqual(rows.map(row => String(row.id)), [String(own.id)])
    assert.equal(rows[0].employee_name, 'API employee')
    assert.equal(response.body.meta.scope, 'self')
    assert.equal(response.body.meta.next_before_id, null)
  })
})

test('time off API: detail hides coworker foreign and missing requests identically', async () => {
  await fixture(async c => {
    const own = await pending(c)
    const other = await pending(c, 'coworker')
    const foreign = await pending(c, 'foreign')
    const row = expectOK(await c.api('employee', `/${own.id}`))
    assert.equal(String(row.id), String(own.id))
    const responses = []
    for (const key of [other.id, foreign.id, '9007199254740991']) {
      const result = await c.api('employee', `/${key}`)
      expectError(result, 404, 'TIME_OFF_REQUEST_NOT_FOUND')
      assert.equal(result.cache, 'no-store')
      responses.push(result.body)
    }
    assert.deepEqual(responses[0], responses[1])
    assert.deepEqual(responses[1], responses[2])
  })
})

for (const role of ['owner', 'admin']) {
  test(`time off API: ${role} lists salon queue without foreign requests`, async () => {
    await fixture(async c => {
      const own = await pending(c)
      const coworker = await pending(c, 'coworker')
      const foreign = await pending(c, 'foreign')
      const response = await c.api(role)
      const rows = expectOK(response)
      assert.deepEqual(rows.map(row => String(row.id)), [String(coworker.id), String(own.id)])
      assert.equal(response.body.meta.scope, 'salon')
      expectOK(await c.api(role, `/${own.id}`))
      expectError(await c.api(role, `/${foreign.id}`), 404, 'TIME_OFF_REQUEST_NOT_FOUND')
    })
  })
}

test('time off API: status filter returns only matching visible requests', async () => {
  await fixture(async c => {
    const requests = []
    for (let day = 11; day <= 14; day++) requests.push(await pending(c, 'employee', {
      startDate: `2030-01-${day}`, endDate: `2030-01-${day}`,
    }))
    expectOK(await c.api('owner', `/${requests[1].id}/decision`, 'POST', { decision: 'approved' }))
    expectOK(await c.api('owner', `/${requests[2].id}/decision`, 'POST', { decision: 'rejected' }))
    expectOK(await c.api('employee', `/${requests[3].id}/withdraw`, 'POST'))
    for (const [index, status] of ['pending', 'approved', 'rejected', 'withdrawn'].entries()) {
      const rows = expectOK(await c.api('employee', `?status=${status}`))
      assert.deepEqual(rows.map(row => String(row.id)), [String(requests[index].id)])
      assert.equal(rows[0].status, status)
    }
  })
})

test('time off API: cursor pagination is bounded ordered and has no duplicate rows', async () => {
  await fixture(async c => {
    await pool.query(`INSERT INTO employee_time_off_requests
      (salon_id, employee_id, requester_membership_id, requested_by_user_id, start_date, end_date, type)
      SELECT $1, $2, $3, $4, date '2031-01-01' + day, date '2031-01-01' + day, 'vacation'
      FROM generate_series(0, 54) AS day`,
    [c.salonId, c.employee.employeeId, c.employee.membershipId, c.employee.userId])
    await pending(c, 'coworker')
    await pending(c, 'foreign')
    const first = await c.api('employee', '?status=pending')
    assert.equal(expectOK(first).length, 50)
    const cursor = first.body.meta.next_before_id
    assert.equal(String(cursor), String(first.body.data[49].id))
    const second = await c.api('employee', `?status=pending&before_id=${cursor}`)
    assert.equal(expectOK(second).length, 5)
    assert.equal(second.body.meta.next_before_id, null)
    const ids = [...first.body.data, ...second.body.data].map(row => Number(row.id))
    assert.equal(new Set(ids).size, 55)
    assert.deepEqual(ids, [...ids].sort((a, b) => b - a))
  })
})

test('time off API: invalid filters repeated filters and cursors return 400', async () => {
  await fixture(async c => {
    for (const query of ['?status=all', '?status=', '?status=pending&status=approved', '?before_id=0',
      '?before_id=-1', '?before_id=1e2', '?before_id=9007199254740992', '?before_id=1&before_id=2']) {
      expectError(await c.api('employee', query), 400, 'TIME_OFF_INVALID_INPUT')
    }
  })
})

test('time off API: request IDs require positive safe integers', async () => {
  await fixture(async c => {
    for (const requestId of ['0', '-1', '1e2', 'abc', '9007199254740992']) {
      expectError(await c.api('employee', `/${requestId}`), 400, 'TIME_OFF_INVALID_INPUT')
      expectError(await c.api('employee', `/${requestId}/withdraw`, 'POST'), 400, 'TIME_OFF_INVALID_INPUT')
      expectError(await c.api('owner', `/${requestId}/decision`, 'POST', { decision: 'approved' }), 400, 'TIME_OFF_INVALID_INPUT')
    }
  })
})

test('time off API: forged identity status and source fields are rejected on creation', async () => {
  await fixture(async c => {
    for (const extra of [{ salon_id: c.foreignSalonId }, { actorUserId: c.owner.userId },
      { requested_by_user_id: c.owner.userId }, { employee_id: c.coworker.employeeId },
      { role: 'owner' }, { status: 'approved' }, { source_request_id: 1 }]) {
      expectError(await c.api('employee', '', 'POST', { ...payload, ...extra }), 400, 'TIME_OFF_INVALID_INPUT')
    }
    assert.equal((await pool.query('SELECT id FROM employee_time_off_requests WHERE salon_id = $1', [c.salonId])).rowCount, 0)
  })
})

test('time off API: query parameters cannot change tenant actor or list scope', async () => {
  await fixture(async c => {
    const request = await pending(c)
    for (const query of [`?salon_id=${c.foreignSalonId}`, `?employee_id=${c.coworker.employeeId}`,
      '?scope=salon', `?actorUserId=${c.owner.userId}`, '?limit=100000']) {
      expectError(await c.api('employee', query), 400, 'TIME_OFF_INVALID_INPUT')
    }
    expectError(await c.api('employee', `/${request.id}?salon_id=${c.foreignSalonId}`), 400, 'TIME_OFF_INVALID_INPUT')
    expectError(await c.api('employee', `?salon_id=${c.foreignSalonId}`, 'POST', payload), 400, 'TIME_OFF_INVALID_INPUT')
  })
})

test('time off API: missing array and incomplete creation bodies return 400', async () => {
  await fixture(async c => {
    for (const body of [undefined, [], {}, { ...payload, start_date: '2030-02-30' },
      { ...payload, type: 'invalid' }, { ...payload, note: 123 }]) {
      expectError(await c.api('employee', '', 'POST', body), 400, 'TIME_OFF_INVALID_INPUT')
    }
  })
})

test('time off API: duplicate pending range returns 409', async () => {
  await fixture(async c => {
    expectOK(await c.api('employee', '', 'POST', payload), 201)
    expectError(await c.api('employee', '', 'POST', payload), 409, 'TIME_OFF_REQUEST_DUPLICATE')
  })
})

test('time off API: employee can withdraw own pending request once', async () => {
  await fixture(async c => {
    const request = await pending(c)
    assert.equal(expectOK(await c.api('employee', `/${request.id}/withdraw`, 'POST')).status, 'withdrawn')
    expectError(await c.api('employee', `/${request.id}/withdraw`, 'POST', {}), 409, 'TIME_OFF_REQUEST_NOT_PENDING')
    assert.equal((await linked(request)).length, 0)
  })
})

test('time off API: coworker and owner cannot withdraw another users request', async () => {
  await fixture(async c => {
    const request = await pending(c)
    for (const name of ['coworker', 'owner', 'foreign']) {
      expectError(await c.api(name, `/${request.id}/withdraw`, 'POST'), 404, 'TIME_OFF_REQUEST_NOT_FOUND')
    }
    assert.equal((await stored(c, request)).status, 'pending')
  })
})

for (const role of ['owner', 'admin']) {
  test(`time off API: ${role} approval returns decision and linked absence`, async () => {
    await fixture(async c => {
      const request = await pending(c)
      const data = expectOK(await c.api(role, `/${request.id}/decision`, 'POST', { decision: 'approved', decision_note: 'Agreed' }))
      assert.equal(data.request.status, 'approved')
      assert.equal(data.request.decision_actor_role, role)
      assert.equal(Number(data.request.decided_by_user_id), c[role].userId)
      assert.equal(String(data.time_off.source_request_id), String(request.id))
      assert.equal((await linked(request)).length, 1)
      expectError(await c.api(role, `/${request.id}/decision`, 'POST', { decision: 'rejected' }), 409, 'TIME_OFF_REQUEST_NOT_PENDING')
    })
  })
}

test('time off API: rejection records note and creates no absence', async () => {
  await fixture(async c => {
    const request = await pending(c)
    const data = expectOK(await c.api('owner', `/${request.id}/decision`, 'POST', { decision: 'rejected', decision_note: 'Unavailable' }))
    assert.equal(data.request.status, 'rejected')
    assert.equal(data.request.decision_note, 'Unavailable')
    assert.equal(data.time_off, null)
    assert.equal((await linked(request)).length, 0)
  })
})

test('time off API: employee cannot decide even with stale owner middleware role', async () => {
  await fixture(async c => {
    const request = await pending(c, 'coworker')
    await override(c, 'employee', 'direct')
    expectError(await c.api('employee', `/${request.id}/decision`, 'POST', { decision: 'approved' }, { role: 'owner' }), 403, 'TIME_OFF_REVIEW_FORBIDDEN')
    const response = await c.api('employee', '', 'GET', undefined, { role: 'owner' })
    assert.equal(expectOK(response).length, 0)
    assert.equal(response.body.meta.scope, 'self')
  })
})

test('time off API: revoked admin permission removes queue and decision access', async () => {
  await fixture(async c => {
    const request = await pending(c)
    assert.equal(expectOK(await c.api('admin')).length, 1)
    for (const value of ['deny', 'approval']) {
      await override(c, 'admin', value)
      const response = await c.api('admin')
      assert.equal(expectOK(response).length, 0)
      assert.equal(response.body.meta.scope, 'self')
      expectError(await c.api('admin', `/${request.id}`), 404, 'TIME_OFF_REQUEST_NOT_FOUND')
      expectError(await c.api('admin', `/${request.id}/decision`, 'POST', { decision: 'approved' }), 403, 'TIME_OFF_REVIEW_FORBIDDEN')
    }
  })
})

test('time off API: employee can read and withdraw own history after submission denial', async () => {
  await fixture(async c => {
    const request = await pending(c)
    await override(c, 'employee', 'deny')
    expectError(await c.api('employee', '', 'POST', { ...payload, start_date: '2030-01-11', end_date: '2030-01-11' }), 403, 'SALON_PERMISSION_DENIED')
    assert.equal(expectOK(await c.api('employee')).length, 1)
    expectOK(await c.api('employee', `/${request.id}`))
    expectOK(await c.api('employee', `/${request.id}/withdraw`, 'POST'))
  })
})

test('time off API: promoted requester cannot decide own request', async () => {
  await fixture(async c => {
    const request = await pending(c)
    await pool.query("UPDATE salon_memberships SET role = 'admin' WHERE id = $1", [c.employee.membershipId])
    for (const decision of ['approved', 'rejected']) {
      expectError(await c.api('employee', `/${request.id}/decision`, 'POST', { decision }), 403, 'TIME_OFF_SELF_REVIEW_FORBIDDEN')
    }
  })
})

test('time off API: foreign requests cannot be decided by another salon owner', async () => {
  await fixture(async c => {
    const request = await pending(c, 'foreign')
    expectError(await c.api('owner', `/${request.id}/decision`, 'POST', { decision: 'approved' }), 404, 'TIME_OFF_REQUEST_NOT_FOUND')
    assert.equal((await linked(request)).length, 0)
  })
})

test('time off API: existing absence conflict leaves request pending', async () => {
  await fixture(async c => {
    const request = await pending(c)
    await pool.query(`INSERT INTO employee_time_off (employee_id, start_date, end_date, type)
      VALUES ($1, '2030-01-10', '2030-01-11', 'personal')`, [c.employee.employeeId])
    expectError(await c.api('owner', `/${request.id}/decision`, 'POST', { decision: 'approved' }), 409, 'TIME_OFF_EXISTING_ABSENCE_CONFLICT')
    assert.equal((await stored(c, request)).status, 'pending')
    assert.equal((await linked(request)).length, 0)
  })
})

test('time off API: active appointment conflict is returned as 409', async () => {
  await fixture(async c => {
    const request = await pending(c)
    const client = await pool.query(`INSERT INTO clients (salon_id, name, phone_country_code, phone_number, phone_normalized)
      VALUES ($1, 'API client', '+385', '911234567', '+385911234567') RETURNING id`, [c.salonId])
    const service = await pool.query(`INSERT INTO services (salon_id, name, category, price_cents, default_duration_minutes)
      VALUES ($1, 'API service', 'Test', 3000, 30) RETURNING id`, [c.salonId])
    await pool.query(`INSERT INTO employee_services (employee_id, service_id, salon_id) VALUES ($1, $2, $3)`,
    [c.employee.employeeId, service.rows[0].id, c.salonId])
    await pool.query(`INSERT INTO appointments (salon_id, client_id, employee_id, service_id, starts_at, ends_at,
      price_cents, duration_minutes, status, source)
      VALUES ($1, $2, $3, $4, '2030-01-09T09:00:00Z', '2030-01-09T09:30:00Z', 3000, 30, 'confirmed', 'manual')`,
    [c.salonId, client.rows[0].id, c.employee.employeeId, service.rows[0].id])
    expectError(await c.api('owner', `/${request.id}/decision`, 'POST', { decision: 'approved' }), 409, 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT')
    assert.equal((await stored(c, request)).status, 'pending')
    assert.equal((await linked(request)).length, 0)
  })
})

for (const target of ['membership', 'user', 'salon']) {
  test(`time off API: inactive ${target} blocks requests despite stale middleware context`, async () => {
    await fixture(async c => {
      const request = await pending(c)
      const queries = {
        membership: ['UPDATE salon_memberships SET active = false WHERE id = $1', c.employee.membershipId, 'TIME_OFF_ACTOR_FORBIDDEN'],
        user: ['UPDATE users SET active = false WHERE id = $1', c.employee.userId, 'TIME_OFF_ACTOR_FORBIDDEN'],
        salon: ['UPDATE salons SET active = false WHERE id = $1', c.salonId, 'TIME_OFF_SALON_UNAVAILABLE'],
      }
      const [sql, key, code] = queries[target]
      await pool.query(sql, [key])
      expectError(await c.api('employee'), 403, code)
      expectError(await c.api('employee', `/${request.id}`), 403, code)
      expectError(await c.api('employee', '', 'POST', payload), 403, code)
      expectError(await c.api('employee', `/${request.id}/withdraw`, 'POST'), 403, code)
    })
  })
}

test('time off API: invalid decision and extra write fields return 400', async () => {
  await fixture(async c => {
    const request = await pending(c)
    for (const body of [undefined, [], {}, { decision: 'pending' }, { decision: 'approved', decision_note: 3 },
      { decision: 'approved', decided_by_user_id: c.employee.userId }]) {
      expectError(await c.api('owner', `/${request.id}/decision`, 'POST', body), 400, 'TIME_OFF_INVALID_INPUT')
    }
    expectError(await c.api('employee', `/${request.id}/withdraw`, 'POST', { status: 'withdrawn' }), 400, 'TIME_OFF_INVALID_INPUT')
    assert.equal((await stored(c, request)).status, 'pending')
  })
})

test('time off API: concurrent HTTP approvals produce exactly one absence', async () => {
  await fixture(async c => {
    const request = await pending(c)
    const results = await Promise.all([
      c.api('owner', `/${request.id}/decision`, 'POST', { decision: 'approved' }),
      c.api('admin', `/${request.id}/decision`, 'POST', { decision: 'approved' }),
    ])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
    expectError(results.find(result => result.status === 409), 409, 'TIME_OFF_REQUEST_NOT_PENDING')
    assert.equal((await linked(request)).length, 1)
  })
})

test('time off API: all endpoints reject absent authentication context', async () => {
  for (const [path, method, body] of [
    ['', 'GET'], ['/1', 'GET'], ['', 'POST', payload],
    ['/1/withdraw', 'POST'], ['/1/decision', 'POST', { decision: 'approved' }],
  ]) {
    const result = await fetchApp(createApp(), path, method, body)
    expectError(result, 401, 'TIME_OFF_AUTH_REQUIRED')
    assert.equal(result.cache, 'no-store')
  }
})

test('time off API: all routes are behind injected private middleware', async () => {
  const app = createApp({ privateRouteMiddleware: [(_req, res) => res.status(401).json({ error: { code: 'TEST_AUTH_BLOCKED' } })] })
  for (const [path, method, body] of [
    ['', 'GET'], ['/1', 'GET'], ['', 'POST', payload],
    ['/1/withdraw', 'POST'], ['/1/decision', 'POST', { decision: 'approved' }],
  ]) expectError(await fetchApp(app, path, method, body), 401, 'TEST_AUTH_BLOCKED')
})

test('time off API: missing salon context cannot be supplied through body', async () => {
  const app = createApp({ privateRouteMiddleware: [(req, _res, next) => {
    req.currentUser = { id: 1, active: true }
    next()
  }] })
  expectError(await fetchApp(app, '', 'POST', { ...payload, salon_id: 1 }), 403, 'TIME_OFF_SALON_CONTEXT_REQUIRED')
})
