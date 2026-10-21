import test, {
  before,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  requireCurrentSalon,
} from '../src/middleware/currentSalonMiddleware.js'

import {
  getCurrentAuth,
} from '../src/controllers/authController.js'

let salonId
let employeeId
let userId

const token =
  `${Date.now()}-${process.pid}`

before(async () => {
  const salonResult =
    await pool.query(
      `
        INSERT INTO salons (
          name,
          timezone
        )
        VALUES (
          $1,
          'Europe/Zagreb'
        )
        RETURNING id
      `,
      [
        `Employee Identity Salon ${token}`,
      ]
    )

  salonId =
    Number(salonResult.rows[0].id)

  const employeeResult =
    await pool.query(
      `
        INSERT INTO employees (
          salon_id,
          name
        )
        VALUES (
          $1,
          'Employee Identity Test'
        )
        RETURNING id
      `,
      [salonId]
    )

  employeeId =
    Number(employeeResult.rows[0].id)

  const userResult =
    await pool.query(
      `
        INSERT INTO users (
          auth_provider,
          auth_subject,
          email,
          display_name
        )
        VALUES (
          'test',
          $1,
          $2,
          'Employee Identity User'
        )
        RETURNING
          id,
          email,
          display_name,
          active
      `,
      [
        `employee-identity-${token}`,
        `employee-identity-${token}@example.test`,
      ]
    )

  userId =
    Number(userResult.rows[0].id)

  await pool.query(
    `
      INSERT INTO salon_memberships (
        user_id,
        salon_id,
        role,
        employee_id
      )
      VALUES (
        $1,
        $2,
        'employee',
        $3
      )
    `,
    [
      userId,
      salonId,
      employeeId,
    ]
  )
})

after(async () => {
  if (salonId) {
    await pool.query(
      `
        DELETE FROM salons
        WHERE id = $1
      `,
      [salonId]
    )
  }

  if (userId) {
    await pool.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [userId]
    )
  }

  await pool.end()
})

test(
  'requireCurrentSalon exposes employeeId on current membership',
  async () => {
    const req = {
      currentUser: {
        id: userId,
      },
    }

    let nextError = null
    let nextCalled = false

    await requireCurrentSalon(
      req,
      {},
      (error) => {
        nextCalled = true
        nextError = error ?? null
      }
    )

    assert.equal(
      nextCalled,
      true
    )

    assert.equal(
      nextError,
      null
    )

    assert.equal(
      req.currentMembership.role,
      'employee'
    )

    assert.equal(
      req.currentMembership.employeeId,
      employeeId
    )

    assert.equal(
      Number(req.currentSalon.id),
      salonId
    )
  }
)

test(
  'auth response exposes employee_id from current membership',
  async () => {
    const userResult = await pool.query(
      `
        SELECT
          id,
          email,
          display_name,
          active
        FROM users
        WHERE id = $1
      `,
      [userId]
    )

    const req = {
      currentUser: userResult.rows[0],
    }

    let middlewareError = null
    let middlewareCalled = false

    await requireCurrentSalon(
      req,
      {},
      (error) => {
        middlewareCalled = true
        middlewareError = error ?? null
      }
    )

    assert.equal(middlewareCalled, true)
    assert.equal(middlewareError, null)

    let statusCode = null
    let responseBody = null
    let controllerError = null
    let controllerNextCalled = false

    const headers = {}

    const res = {
      set(name, value) {
        headers[name] = value
        return this
      },

      status(code) {
        statusCode = code
        return this
      },

      json(body) {
        responseBody = body
        return this
      },
    }

    await getCurrentAuth(
      req,
      res,
      (error) => {
        controllerNextCalled = true
        controllerError = error ?? null
      }
    )

    assert.ifError(controllerError)
    assert.equal(controllerNextCalled, false)
    assert.equal(statusCode, 200)
    assert.equal(headers['Cache-Control'], 'no-store')

    assert.equal(
      responseBody.data.membership.role,
      'employee'
    )

    assert.equal(
      responseBody.data.membership.employee_id,
      employeeId
    )

    assert.equal(
      Number(responseBody.data.current_salon.id),
      salonId
    )

    assert.deepEqual(
      responseBody.data.permissions,
      {
        'appointment.create': 'self',
        'appointment.reschedule': 'deny',
        'appointment.change_status': 'deny',
        'appointment.change_client': 'deny',
      }
    )
  }
)