import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'
import pool from '../src/database/pool.js'
import {
  submitEmployeeTimeOffRequest as submit,
  withdrawEmployeeTimeOffRequest as withdraw,
  decideEmployeeTimeOffRequest as decide,
} from '../src/services/employeeTimeOffRequestService.js'
import { resolveSalonPermission } from '../src/services/salonPermissionService.js'
import { prepareAppointmentCreation } from '../src/services/appointmentService.js'

after(async () => { await pool.end() })

async function fixture(run) {
  const salonIds = []
  const userIds = []
  try {
    for (let i = 0; i < 2; i++) {
      const result = await pool.query(`INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb') RETURNING id`, [`Requests ${randomUUID()}`])
      salonIds.push(Number(result.rows[0].id))
    }
    const c = { salonId: salonIds[0], foreignSalonId: salonIds[1] }
    for (const role of ['owner', 'admin', 'employee', 'coworker', 'foreign']) {
      const token = randomUUID()
      const user = await pool.query(`INSERT INTO users (auth_provider, auth_subject, email, display_name)
        VALUES ('test', $1, $2, 'Request test') RETURNING id`, [token, `${token}@example.test`])
      const userId = Number(user.rows[0].id)
      userIds.push(userId)
      const salonId = role === 'foreign' ? c.foreignSalonId : c.salonId
      let employeeId = null
      if (!['owner', 'admin'].includes(role)) {
        const employee = await pool.query(`INSERT INTO employees (salon_id, name)
          VALUES ($1, 'Request employee') RETURNING id`, [salonId])
        employeeId = Number(employee.rows[0].id)
      }
      const member = await pool.query(`INSERT INTO salon_memberships (salon_id, user_id, role, employee_id)
        VALUES ($1, $2, $3, $4) RETURNING id`,
      [salonId, userId, ['owner', 'admin'].includes(role) ? role : 'employee', employeeId])
      c[role] = { userId, employeeId, membershipId: Number(member.rows[0].id) }
    }
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

function input(c, extra = {}) {
  return { salonId: c.salonId, actorUserId: c.employee.userId,
    startDate: '2030-01-09', endDate: '2030-01-10', type: 'vacation', ...extra }
}
function review(c, request, extra = {}) {
  return decide({ salonId: c.salonId, actorUserId: c.owner.userId,
    requestId: request.id, decision: 'approved', ...extra })
}
function retract(c, request, extra = {}) {
  return withdraw({ salonId: c.salonId, actorUserId: c.employee.userId, requestId: request.id, ...extra })
}
async function reject(operation, code, statusCode) {
  await assert.rejects(operation, error => {
    assert.equal(error.code, code)
    if (statusCode) assert.equal(error.statusCode, statusCode)
    return true
  })
}
async function stored(c, request) {
  return (await pool.query('SELECT * FROM employee_time_off_requests WHERE salon_id = $1 AND id = $2', [c.salonId, request.id])).rows[0]
}
async function absences(c) {
  return (await pool.query('SELECT * FROM employee_time_off WHERE employee_id = $1', [c.employee.employeeId])).rows
}
async function override(c, role, value, db = pool, key = 'schedule.time_off') {
  await db.query(`INSERT INTO salon_permission_overrides (salon_id, role, permission_key, permission_value)
    VALUES ($1, $2, $3, $4) ON CONFLICT (salon_id, role, permission_key)
    DO UPDATE SET permission_value = EXCLUDED.permission_value`, [c.salonId, role, key, value])
}
async function appointment(c, db = pool) {
  await db.query(`INSERT INTO appointments (salon_id, client_id, employee_id, service_id,
    starts_at, ends_at, price_cents, duration_minutes, status, source)
    VALUES ($1, $2, $3, $4, '2030-01-09T09:00:00Z', '2030-01-09T09:30:00Z', 3000, 30, 'confirmed', 'manual')`,
  [c.salonId, c.booking.client_id, c.employee.employeeId, c.booking.service_id])
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

test('request service: submit uses linked identity and does not block booking', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c, { employeeId: c.foreign.employeeId, status: 'approved', note: '  Holiday  ' }))
    assert.equal(request.status, 'pending')
    assert.equal(Number(request.employee_id), c.employee.employeeId)
    assert.equal(request.start_date, '2030-01-09')
    assert.equal(request.note, 'Holiday')
    assert.equal((await absences(c)).length, 0)
    const booking = await prepareAppointmentCreation(c.booking)
    assert.equal(booking.error, undefined)
    assert.equal((await pool.query('SELECT id FROM appointments WHERE salon_id = $1', [c.salonId])).rowCount, 1)
  })
})

test('request service: invalid dates types notes and IDs are rejected', async () => {
  await fixture(async c => {
    for (const extra of [
      { salonId: 0 }, { actorUserId: '1e2' }, { startDate: '2030-02-30' },
      { startDate: '0000-01-01' }, { endDate: '2030-01-08' }, { startDate: '2030-1-09' },
      { type: 'unknown' }, { note: 42 }, { note: 'x'.repeat(501) }, { note: 'bad\0note' },
    ]) await reject(submit(input(c, extra)), 'TIME_OFF_INVALID_INPUT', 400)
    assert.equal((await pool.query('SELECT id FROM employee_time_off_requests WHERE salon_id = $1', [c.salonId])).rowCount, 0)
  })
})

test('request service: duplicate pending range is a domain conflict', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await reject(submit(input(c, { type: 'other' })), 'TIME_OFF_REQUEST_DUPLICATE', 409)
    await retract(c, request)
    assert.equal((await submit(input(c))).request.status, 'pending')
  })
})

test('request service: deny prevents submission and direct still creates a pending request', async () => {
  await fixture(async c => {
    await override(c, 'employee', 'deny')
    await reject(submit(input(c)), 'SALON_PERMISSION_DENIED', 403)
    await override(c, 'employee', 'direct')
    assert.equal((await submit(input(c))).request.status, 'pending')
  })
})

for (const target of ['membership', 'user', 'employee', 'salon']) {
  test(`request service: inactive ${target} cannot submit`, async () => {
    await fixture(async c => {
      const queries = {
        membership: ['UPDATE salon_memberships SET active = false WHERE id = $1', c.employee.membershipId, 'TIME_OFF_ACTOR_FORBIDDEN'],
        user: ['UPDATE users SET active = false WHERE id = $1', c.employee.userId, 'TIME_OFF_ACTOR_FORBIDDEN'],
        employee: ['UPDATE employees SET active = false WHERE id = $1', c.employee.employeeId, 'TIME_OFF_EMPLOYEE_UNAVAILABLE'],
        salon: ['UPDATE salons SET active = false WHERE id = $1', c.salonId, 'TIME_OFF_SALON_UNAVAILABLE'],
      }
      const [sql, key, code] = queries[target]
      await pool.query(sql, [key])
      await reject(submit(input(c)), code)
    })
  })
}

test('request service: unlinked owner cannot submit a request', async () => {
  await fixture(async c => {
    await reject(submit(input(c, { actorUserId: c.owner.userId })), 'TIME_OFF_EMPLOYEE_REQUIRED', 409)
  })
})

test('request service: withdrawal remains possible after submission permission is revoked', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await override(c, 'employee', 'deny')
    const result = await retract(c, request)
    assert.equal(result.request.status, 'withdrawn')
    assert.ok(result.request.withdrawn_at)
    assert.equal(result.request.decided_at, null)
    assert.equal((await absences(c)).length, 0)
    await reject(retract(c, request), 'TIME_OFF_REQUEST_NOT_PENDING', 409)
  })
})

test('request service: coworker and owner cannot withdraw another users request', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    for (const actorUserId of [c.coworker.userId, c.owner.userId]) {
      await reject(retract(c, request, { actorUserId }), 'TIME_OFF_REQUEST_NOT_FOUND', 404)
    }
    assert.equal((await stored(c, request)).status, 'pending')
  })
})

test('request service: tenant isolation covers submission withdrawal and review', async () => {
  await fixture(async c => {
    await reject(submit(input(c, { actorUserId: c.foreign.userId })), 'TIME_OFF_ACTOR_FORBIDDEN', 403)
    const { request } = await submit(input(c))
    await reject(retract(c, request, { salonId: c.foreignSalonId, actorUserId: c.foreign.userId }), 'TIME_OFF_REQUEST_NOT_FOUND', 404)
    await pool.query("UPDATE salon_memberships SET role = 'admin' WHERE id = $1", [c.foreign.membershipId])
    await reject(review(c, request, { salonId: c.foreignSalonId, actorUserId: c.foreign.userId }), 'TIME_OFF_REQUEST_NOT_FOUND', 404)
    assert.equal((await stored(c, request)).status, 'pending')
  })
})

for (const role of ['owner', 'admin']) {
  test(`request service: ${role} approval saves decision and one linked absence`, async () => {
    await fixture(async c => {
      const { request } = await submit(input(c, { note: 'Holiday' }))
      const result = await review(c, request, { actorUserId: c[role].userId, decisionNote: 'Agreed' })
      assert.equal(result.request.status, 'approved')
      assert.equal(result.request.decision_actor_role, role)
      assert.equal(result.request.decision_note, 'Agreed')
      assert.equal(Number(result.request.decided_by_user_id), c[role].userId)
      assert.equal(String(result.timeOff.source_request_id), String(request.id))
      assert.equal(result.timeOff.start_date, request.start_date)
      assert.equal(result.timeOff.end_date, request.end_date)
      assert.equal(result.timeOff.note, 'Holiday')
      assert.equal((await absences(c)).length, 1)
      await reject(review(c, request), 'TIME_OFF_REQUEST_NOT_PENDING', 409)
      await reject(retract(c, request), 'TIME_OFF_REQUEST_NOT_PENDING', 409)
    })
  })
}

test('request service: rejection records reviewer without an absence', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    const result = await review(c, request, { decision: 'rejected', decisionNote: 'Busy period' })
    assert.equal(result.request.status, 'rejected')
    assert.equal(result.request.decision_note, 'Busy period')
    assert.equal(result.timeOff, null)
    assert.equal((await absences(c)).length, 0)
    await reject(review(c, request), 'TIME_OFF_REQUEST_NOT_PENDING', 409)
  })
})

test('request service: employee direct permission does not confer reviewer authority', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await override(c, 'employee', 'direct')
    await reject(review(c, request, { actorUserId: c.coworker.userId }), 'TIME_OFF_REVIEW_FORBIDDEN', 403)
  })
})

test('request service: admin must have direct permission', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    for (const value of ['deny', 'approval']) {
      await override(c, 'admin', value)
      await reject(review(c, request, { actorUserId: c.admin.userId }), 'TIME_OFF_REVIEW_FORBIDDEN', 403)
    }
    assert.equal((await stored(c, request)).status, 'pending')
  })
})

test('request service: promoted requester cannot review own request', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await pool.query("UPDATE salon_memberships SET role = 'admin' WHERE id = $1", [c.employee.membershipId])
    for (const decision of ['approved', 'rejected']) {
      await reject(review(c, request, { actorUserId: c.employee.userId, decision }), 'TIME_OFF_SELF_REVIEW_FORBIDDEN', 403)
    }
  })
})

for (const target of ['membership', 'user', 'employee']) {
  test(`request service: inactive requester ${target} blocks approval but permits rejection`, async () => {
    await fixture(async c => {
      const { request } = await submit(input(c))
      const queries = {
        membership: ['UPDATE salon_memberships SET active = false WHERE id = $1', c.employee.membershipId],
        user: ['UPDATE users SET active = false WHERE id = $1', c.employee.userId],
        employee: ['UPDATE employees SET active = false WHERE id = $1', c.employee.employeeId],
      }
      await pool.query(queries[target][0], [queries[target][1]])
      await reject(review(c, request), 'TIME_OFF_REQUESTER_UNAVAILABLE', 409)
      assert.equal((await stored(c, request)).status, 'pending')
      assert.equal((await absences(c)).length, 0)
      assert.equal((await review(c, request, { decision: 'rejected' })).request.status, 'rejected')
    })
  })
}

test('request service: appointment conflict leaves request pending', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await appointment(c)
    await reject(review(c, request), 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT', 409)
    const row = await stored(c, request)
    assert.equal(row.status, 'pending')
    assert.equal(row.decided_at, null)
    assert.equal((await absences(c)).length, 0)
  })
})

test('request service: inclusive existing absence overlap blocks approval', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await pool.query(`INSERT INTO employee_time_off (employee_id, start_date, end_date, type)
      VALUES ($1, '2030-01-10', '2030-01-11', 'personal')`, [c.employee.employeeId])
    await reject(review(c, request), 'TIME_OFF_EXISTING_ABSENCE_CONFLICT', 409)
    assert.equal((await stored(c, request)).status, 'pending')
    assert.equal((await absences(c)).length, 1)
  })
})

test('request service: concurrent approvals create exactly one linked absence', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    const results = await Promise.allSettled([
      review(c, request), review(c, request, { actorUserId: c.admin.userId }),
    ])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'TIME_OFF_REQUEST_NOT_PENDING')
    assert.equal((await absences(c)).length, 1)
  })
})

test('request service: approval and withdrawal cannot both succeed', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    const results = await Promise.allSettled([review(c, request), retract(c, request)])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'TIME_OFF_REQUEST_NOT_PENDING')
    const row = await stored(c, request)
    assert.ok(['approved', 'withdrawn'].includes(row.status))
    assert.equal((await absences(c)).length, row.status === 'approved' ? 1 : 0)
  })
})

test('request service: approval waits for booking and sees committed appointment', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await race(
      async db => {
        const booking = await prepareAppointmentCreation(c.booking, db)
        assert.equal(booking.error, undefined)
      },
      () => review(c, request), async () => {},
      async result => {
        assert.equal(result.error?.code, 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT')
        assert.equal((await stored(c, request)).status, 'pending')
        assert.equal((await absences(c)).length, 0)
      }
    )
  })
})

test('request service: approval observes membership deactivation committed ahead of it', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await race(
      db => db.query('SELECT id FROM salons WHERE id = $1 FOR UPDATE', [c.salonId]),
      () => review(c, request, { actorUserId: c.admin.userId }),
      db => db.query('UPDATE salon_memberships SET active = false WHERE id = $1', [c.admin.membershipId]),
      async result => {
        assert.equal(result.error?.code, 'TIME_OFF_ACTOR_FORBIDDEN')
        assert.equal((await stored(c, request)).status, 'pending')
      }
    )
  })
})

test('request service: approval observes permission revocation committed ahead of it', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await race(
      db => db.query('SELECT id FROM salons WHERE id = $1 FOR UPDATE', [c.salonId]),
      () => review(c, request, { actorUserId: c.admin.userId }),
      db => override(c, 'admin', 'deny', db),
      async result => {
        assert.equal(result.error?.code, 'TIME_OFF_REVIEW_FORBIDDEN')
        assert.equal((await stored(c, request)).status, 'pending')
      }
    )
  })
})

test('permission transaction: role override reads uncommitted data on supplied connection', async () => {
  await fixture(async c => {
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      await override(c, 'admin', 'deny', db)
      const args = { salonId: c.salonId, role: 'admin', permissionKey: 'schedule.time_off' }
      assert.equal(await resolveSalonPermission(args, db), 'deny')
      assert.equal(await resolveSalonPermission(args), 'direct')
    } finally { await db.query('ROLLBACK'); db.release() }
  })
})

test('permission transaction: member override reads uncommitted data on supplied connection', async () => {
  await fixture(async c => {
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      await db.query(`INSERT INTO salon_member_permission_overrides
        (salon_id, membership_id, permission_key, permission_value)
        VALUES ($1, $2, 'appointment.create', 'deny')`, [c.salonId, c.employee.membershipId])
      const args = { salonId: c.salonId, role: 'employee', membershipId: c.employee.membershipId, permissionKey: 'appointment.create' }
      assert.equal(await resolveSalonPermission(args, db), 'deny')
      assert.equal(await resolveSalonPermission(args), 'self')
    } finally { await db.query('ROLLBACK'); db.release() }
  })
})

test('request service: failed linked absence insert rolls back decision', async t => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    const realConnect = pool.connect.bind(pool)
    const injected = Object.assign(new Error('Injected absence insert failure'), { code: 'TEST_INSERT_FAILURE' })
    const mock = t.mock.method(pool, 'connect', async () => {
      const db = await realConnect()
      return {
        query(sql, values) {
          if (/INSERT INTO employee_time_off\s*\(/.test(sql)) throw injected
          return db.query(sql, values)
        },
        release(error) { db.release(error) },
      }
    })
    try {
      await assert.rejects(review(c, request), error => error === injected)
    } finally { mock.mock.restore() }
    const row = await stored(c, request)
    assert.equal(row.status, 'pending')
    assert.equal(row.decided_at, null)
    assert.equal(row.decided_by_user_id, null)
    assert.equal((await absences(c)).length, 0)
  })
})

test('request service: overlapping requests cannot both be approved', async () => {
  await fixture(async c => {
    const first = (await submit(input(c))).request
    const second = (await submit(input(c, { startDate: '2030-01-10', endDate: '2030-01-11' }))).request
    const results = await Promise.allSettled([review(c, first), review(c, second)])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'TIME_OFF_EXISTING_ABSENCE_CONFLICT')
    assert.equal((await absences(c)).length, 1)
  })
})

test('request service: booking FK checks can finish while approval waits for employee', async () => {
  await fixture(async c => {
    const { request } = await submit(input(c))
    await race(
      async db => {
        await db.query("SET LOCAL lock_timeout = '3s'")
        await db.query('SELECT id FROM employees WHERE id = $1 FOR UPDATE', [c.employee.employeeId])
      },
      () => review(c, request),
      db => appointment(c, db),
      async result => {
        assert.equal(result.error?.code, 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT')
        assert.equal((await stored(c, request)).status, 'pending')
      }
    )
  })
})
