import test, {
  before,
  beforeEach,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  getCurrentAuth,
} from '../src/controllers/authController.js'

let salonId
let employeeId

before(async () => {
  const salonResult = await pool.query(
    `
      INSERT INTO salons (name, timezone)
      VALUES ($1, 'Europe/Zagreb')
      RETURNING id
    `,
    [`Auth Permissions Test ${Date.now()}-${process.pid}`]
  )

  salonId = Number(salonResult.rows[0].id)

  const employeeResult = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Auth Permissions Employee')
      RETURNING id
    `,
    [salonId]
  )

  employeeId = Number(employeeResult.rows[0].id)
})

beforeEach(async () => {
  await pool.query(
    'DELETE FROM salon_permission_overrides WHERE salon_id = $1',
    [salonId]
  )
})

after(async () => {
  try {
    if (salonId) {
      await pool.query(
        'DELETE FROM salons WHERE id = $1',
        [salonId]
      )
    }
  } finally {
    await pool.end()
  }
})

async function setOverride(role, permissionKey, value) {
  await pool.query(
    `
      INSERT INTO salon_permission_overrides (
        salon_id,
        role,
        permission_key,
        permission_value
      )
      VALUES ($1, $2, $3, $4)
    `,
    [salonId, role, permissionKey, value]
  )
}

async function invokeController(role) {
  const result = {
    headers: {},
    statusCode: null,
    body: null,
    error: null,
  }

  const req = {
    currentUser: {
      id: 1,
      email: 'permissions-test@example.test',
      display_name: 'Permissions Test',
      active: true,
    },
    currentSalon: {
      id: salonId,
      name: 'Permissions Test Salon',
      timezone: 'Europe/Zagreb',
      active: true,
    },
    currentMembership: {
      id: 1,
      role,
      employeeId: role === 'employee' ? employeeId : null,
      active: true,
    },
  }

  const res = {
    set(name, value) {
      result.headers[name] = value
      return this
    },
    status(code) {
      result.statusCode = code
      return this
    },
    json(body) {
      result.body = body
      return this
    },
  }

  await getCurrentAuth(req, res, (error) => {
    result.error = error
  })

  return result
}

const employeeDefaults = {
  'appointment.create': 'self',
  'appointment.reschedule': 'deny',
  'appointment.change_status': 'deny',
  'appointment.change_client': 'deny',
}

test('auth permissions: employee receives defaults and own identity', async () => {
  const result = await invokeController('employee')

  assert.equal(result.error, null)
  assert.equal(result.statusCode, 200)
  assert.equal(result.headers['Cache-Control'], 'no-store')
  assert.equal(result.body.data.authenticated, true)
  assert.equal(
    result.body.data.membership.employee_id,
    employeeId
  )
  assert.deepEqual(
    result.body.data.permissions,
    employeeDefaults
  )
})

test('auth permissions: owner and admin receive all by default', async () => {
  const expected = {
    'appointment.create': 'all',
    'appointment.reschedule': 'all',
    'appointment.change_status': 'all',
    'appointment.change_client': 'all',
  }

  for (const role of ['owner', 'admin']) {
    const result = await invokeController(role)

    assert.equal(result.error, null)
    assert.equal(result.statusCode, 200)
    assert.deepEqual(result.body.data.permissions, expected)
  }
})

test('auth permissions: reschedule override changes only its own action', async () => {
  await setOverride(
    'employee',
    'appointment.reschedule',
    'self'
  )

  const result = await invokeController('employee')

  assert.equal(result.error, null)
  assert.deepEqual(result.body.data.permissions, {
    ...employeeDefaults,
    'appointment.reschedule': 'self',
  })
})

test('auth permissions: create deny is returned to frontend', async () => {
  await setOverride(
    'employee',
    'appointment.create',
    'deny'
  )

  const result = await invokeController('employee')

  assert.equal(result.error, null)
  assert.deepEqual(result.body.data.permissions, {
    ...employeeDefaults,
    'appointment.create': 'deny',
  })
})

test('auth permissions: admin override is respected', async () => {
  await setOverride(
    'admin',
    'appointment.change_status',
    'deny'
  )

  const result = await invokeController('admin')

  assert.equal(result.error, null)
  assert.equal(
    result.body.data.permissions['appointment.change_status'],
    'deny'
  )
  assert.equal(
    result.body.data.permissions['appointment.create'],
    'all'
  )
})

test('auth permissions: invalid employee all override returns no success body', async () => {
  await setOverride(
    'employee',
    'appointment.reschedule',
    'all'
  )

  const result = await invokeController('employee')

  assert.equal(
    result.error?.code,
    'INVALID_SALON_PERMISSION_OVERRIDE'
  )
  assert.equal(result.statusCode, null)
  assert.equal(result.body, null)
})