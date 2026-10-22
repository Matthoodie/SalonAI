import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'

import pool from '../src/database/pool.js'
import { createApp } from '../src/createApp.js'

import {
  requireCurrentSalon,
} from '../src/middleware/currentSalonMiddleware.js'

const token = `${Date.now()}-${process.pid}`

const salonIds = []

let userId
let ownerEmployeeId
let ownEmployeeId
let server
let baseUrl

before(async () => {
  for (let index = 0; index < 3; index += 1) {
    const result = await pool.query(
      `
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb')
        RETURNING id
      `,
      [`Workspace HTTP ${token}-${index}`]
    )

    salonIds.push(Number(result.rows[0].id))
  }

  const userResult = await pool.query(
    `
      INSERT INTO users (
        auth_provider,
        auth_subject,
        email
      )
      VALUES ('test', $1, $2)
      RETURNING id
    `,
    [
      `workspace-http-${token}`,
      `workspace-http-${token}@example.test`,
    ]
  )

  userId = Number(userResult.rows[0].id)

  const ownerEmployee = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Owner Salon Employee')
      RETURNING id
    `,
    [salonIds[0]]
  )

  ownerEmployeeId = Number(ownerEmployee.rows[0].id)

  const ownEmployee = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Own Employee Profile')
      RETURNING id
    `,
    [salonIds[1]]
  )

  ownEmployeeId = Number(ownEmployee.rows[0].id)

  await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Coworker Profile')
    `,
    [salonIds[1]]
  )

  await pool.query(
    `
      INSERT INTO salon_memberships (
        user_id,
        salon_id,
        role,
        employee_id
      )
      VALUES
        ($1, $2, 'owner', NULL),
        ($1, $3, 'employee', $4)
    `,
    [
      userId,
      salonIds[0],
      salonIds[1],
      ownEmployeeId,
    ]
  )

  function attachAuthenticatedTestUser(req, res, next) {
    req.currentUser = {
      id: userId,
      active: true,
    }

    next()
  }

  const app = createApp({
    privateRouteMiddleware: [
      attachAuthenticatedTestUser,
      requireCurrentSalon,
    ],
  })

  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    }
  } finally {
    try {
      if (userId) {
        await pool.query(
          'DELETE FROM users WHERE id = $1',
          [userId]
        )
      }

      if (salonIds.length > 0) {
        await pool.query(
          'DELETE FROM salons WHERE id = ANY($1::bigint[])',
          [salonIds]
        )
      }
    } finally {
      await pool.end()
    }
  }
})

async function request(
  path,
  salonId,
  {
    method = 'GET',
    body,
  } = {}
) {
  const headers = {}

  if (salonId !== undefined) {
    headers['X-Salon-Id'] = String(salonId)
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

test('workspace HTTP: missing selection blocks business data for multi-salon user', async () => {
  const result = await request('/api/employees')

  assert.equal(result.status, 409)
  assert.equal(
    result.body.error?.code,
    'CURRENT_SALON_SELECTION_REQUIRED'
  )
  assert.equal(Object.hasOwn(result.body, 'data'), false)
})

test('workspace HTTP: each selection returns only its permitted employee scope', async () => {
  const ownerResult = await request(
    '/api/employees',
    salonIds[0]
  )

  assert.equal(ownerResult.status, 200)
  assert.deepEqual(
    ownerResult.body.data.map((employee) => Number(employee.id)),
    [ownerEmployeeId]
  )

  const employeeResult = await request(
    '/api/employees',
    salonIds[1]
  )

  assert.equal(employeeResult.status, 200)
  assert.deepEqual(
    employeeResult.body.data.map((employee) => Number(employee.id)),
    [ownEmployeeId]
  )
})

test('workspace HTTP: owner CRM access does not carry into employee salon', async () => {
  const ownerResult = await request(
    '/api/clients',
    salonIds[0]
  )

  assert.equal(ownerResult.status, 200)

  const employeeResult = await request(
    '/api/clients',
    salonIds[1]
  )

  assert.equal(employeeResult.status, 403)
  assert.equal(
    employeeResult.body.error?.code,
    'INSUFFICIENT_SALON_ROLE'
  )

  const attemptedWrite = await request(
    '/api/employees',
    salonIds[1],
    {
      method: 'POST',
      body: {
        name: 'Forbidden Employee',
        salon_id: salonIds[0],
      },
    }
  )

  assert.equal(attemptedWrite.status, 403)
  assert.equal(
    attemptedWrite.body.error?.code,
    'INSUFFICIENT_SALON_ROLE'
  )

  const stored = await pool.query(
    `
      SELECT id
      FROM employees
      WHERE salon_id = ANY($1::bigint[])
        AND name = 'Forbidden Employee'
    `,
    [salonIds]
  )

  assert.equal(stored.rowCount, 0)
})

test('workspace HTTP: foreign salon and malformed selection expose no data', async () => {
  const foreignResult = await request(
    '/api/employees',
    salonIds[2]
  )

  assert.equal(foreignResult.status, 403)
  assert.equal(
    foreignResult.body.error?.code,
    'SALON_ACCESS_DENIED'
  )
  assert.equal(Object.hasOwn(foreignResult.body, 'data'), false)

  const invalidResult = await request(
    '/api/employees',
    '1,2'
  )

  assert.equal(invalidResult.status, 400)
  assert.equal(
    invalidResult.body.error?.code,
    'INVALID_SELECTED_SALON_ID'
  )
  assert.equal(Object.hasOwn(invalidResult.body, 'data'), false)
})

test('workspace HTTP: query cannot override selected salon or employee identity', async () => {
  const query = new URLSearchParams({
    salonId: String(salonIds[0]),
    salon_id: String(salonIds[0]),
    employeeId: String(ownerEmployeeId),
  })

  const result = await request(
    `/api/employees?${query}`,
    salonIds[1]
  )

  assert.equal(result.status, 200)
  assert.deepEqual(
    result.body.data.map((employee) => Number(employee.id)),
    [ownEmployeeId]
  )
})

test('workspace HTTP: revoked membership blocks next request without fallback', async () => {
  await pool.query(
    `
      UPDATE salon_memberships
      SET active = false
      WHERE user_id = $1 AND salon_id = $2
    `,
    [userId, salonIds[1]]
  )

  try {
    const denied = await request(
      '/api/employees',
      salonIds[1]
    )

    assert.equal(denied.status, 403)
    assert.equal(
      denied.body.error?.code,
      'SALON_ACCESS_DENIED'
    )
    assert.equal(Object.hasOwn(denied.body, 'data'), false)

    const ownerResult = await request(
      '/api/employees',
      salonIds[0]
    )

    assert.equal(ownerResult.status, 200)
  } finally {
    await pool.query(
      `
        UPDATE salon_memberships
        SET active = true
        WHERE user_id = $1 AND salon_id = $2
      `,
      [userId, salonIds[1]]
    )
  }
})