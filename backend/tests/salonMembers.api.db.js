import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'

import pool from '../src/database/pool.js'
import { createApp } from '../src/createApp.js'

import {
  requireCurrentSalon,
} from '../src/middleware/currentSalonMiddleware.js'

const marker = `${Date.now()}-${process.pid}`

const salonIds = []
const users = {}

let employeeId
let secondSalonEmployeeId
let server
let baseUrl

before(async () => {
  for (const label of ['main', 'second', 'foreign']) {
    const result = await pool.query(
      `
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb')
        RETURNING id
      `,
      [`Members HTTP ${marker} ${label}`]
    )

    salonIds.push(Number(result.rows[0].id))
  }

  for (const label of [
    'owner',
    'admin',
    'employee',
    'inactiveMembership',
    'inactiveAccount',
    'foreignOwner',
  ]) {
    const result = await pool.query(
      `
        INSERT INTO users (
          auth_provider,
          auth_subject,
          email,
          display_name,
          active
        )
        VALUES ('test', $1, $2, $3, $4)
        RETURNING id
      `,
      [
        `members-http-${marker}-${label}`,
        `${label.toLowerCase()}-${marker}@example.test`,
        `Member ${label}`,
        label !== 'inactiveAccount',
      ]
    )

    users[label] = Number(result.rows[0].id)
  }

  const firstEmployee = await pool.query(
    `
      INSERT INTO employees (salon_id, name, active)
      VALUES ($1, 'Members Test Employee', false)
      RETURNING id
    `,
    [salonIds[0]]
  )

  employeeId = Number(firstEmployee.rows[0].id)

  const secondEmployee = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Second Salon Employee')
      RETURNING id
    `,
    [salonIds[1]]
  )

  secondSalonEmployeeId =
    Number(secondEmployee.rows[0].id)

  await pool.query(
    `
      INSERT INTO salon_memberships (
        user_id,
        salon_id,
        role,
        employee_id,
        active
      )
      VALUES
        ($1, $7, 'owner', NULL, true),
        ($2, $7, 'admin', NULL, true),
        ($3, $7, 'employee', $10, true),
        ($4, $7, 'admin', NULL, false),
        ($5, $7, 'admin', NULL, true),
        ($1, $8, 'employee', $11, true),
        ($6, $9, 'owner', NULL, true)
    `,
    [
      users.owner,
      users.admin,
      users.employee,
      users.inactiveMembership,
      users.inactiveAccount,
      users.foreignOwner,
      salonIds[0],
      salonIds[1],
      salonIds[2],
      employeeId,
      secondSalonEmployeeId,
    ]
  )

  async function authenticateTestUser(req, res, next) {
    try {
      const rawId = req.headers['x-test-user-id']

      if (
        typeof rawId !== 'string' ||
        !/^[1-9]\d*$/.test(rawId) ||
        !Number.isSafeInteger(Number(rawId))
      ) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
          },
        })
      }

      const result = await pool.query(
        'SELECT id, active FROM users WHERE id = $1',
        [rawId]
      )

      const user = result.rows[0]

      if (!user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
          },
        })
      }

      if (user.active !== true) {
        return res.status(403).json({
          error: {
            code: 'USER_INACTIVE',
          },
        })
      }

      req.currentUser = user
      return next()
    } catch (error) {
      return next(error)
    }
  }

  const app = createApp({
    privateRouteMiddleware: [
      authenticateTestUser,
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
          } else {
            resolve()
          }
        })

        server.closeIdleConnections()
      })
    }
  } finally {
    try {
      if (salonIds.length > 0) {
        await pool.query(
          'DELETE FROM salon_memberships WHERE salon_id = ANY($1::bigint[])',
          [salonIds]
        )

        await pool.query(
          'DELETE FROM salons WHERE id = ANY($1::bigint[])',
          [salonIds]
        )
      }

      const userIds = Object.values(users)

      if (userIds.length > 0) {
        await pool.query(
          'DELETE FROM users WHERE id = ANY($1::bigint[])',
          [userIds]
        )
      }
    } finally {
      await pool.end()
    }
  }
})

async function request({
  userId = users.owner,
  salonId = salonIds[0],
  query = '',
} = {}) {
  const headers = {}

  if (userId !== null) {
    headers['x-test-user-id'] = String(userId)
  }

  if (salonId !== null) {
    headers['X-Salon-Id'] = String(salonId)
  }

  const response = await fetch(
    `${baseUrl}/api/members${query}`,
    { headers }
  )

  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  }
}

test('members HTTP: owner and admin receive only allowed fields and separate activity states', async () => {
  const expectedFields = [
    'id',
    'salon_id',
    'user_id',
    'role',
    'membership_active',
    'created_at',
    'email',
    'display_name',
    'user_active',
    'employee_id',
    'employee_name',
    'employee_active',
  ].sort()

  for (const userId of [users.owner, users.admin]) {
    const result = await request({ userId })

    assert.equal(result.status, 200)
    assert.equal(result.headers.get('cache-control'), 'no-store')

    const members = result.body.data.members

    assert.equal(members.length, 5)

    for (const member of members) {
      assert.equal(Number(member.salon_id), salonIds[0])

      assert.deepEqual(
        Object.keys(member).sort(),
        expectedFields
      )
    }

    const inactiveMembership = members.find(
      (member) =>
        Number(member.user_id) === users.inactiveMembership
    )

    assert.equal(inactiveMembership.membership_active, false)
    assert.equal(inactiveMembership.user_active, true)

    const inactiveAccount = members.find(
      (member) =>
        Number(member.user_id) === users.inactiveAccount
    )

    assert.equal(inactiveAccount.membership_active, true)
    assert.equal(inactiveAccount.user_active, false)

    const employee = members.find(
      (member) => Number(member.user_id) === users.employee
    )

    assert.equal(Number(employee.employee_id), employeeId)
    assert.equal(employee.employee_name, 'Members Test Employee')
    assert.equal(employee.employee_active, false)

    const owner = members.find(
      (member) => Number(member.user_id) === users.owner
    )

    assert.equal(owner.employee_id, null)
    assert.equal(owner.employee_active, null)
  }
})

test('members HTTP: employee cannot list members and owner role does not carry into another salon', async () => {
  for (const context of [
    {
      userId: users.employee,
      salonId: salonIds[0],
    },
    {
      userId: users.owner,
      salonId: salonIds[1],
    },
  ]) {
    const result = await request(context)

    assert.equal(result.status, 403)
    assert.equal(
      result.body.error.code,
      'INSUFFICIENT_SALON_ROLE'
    )

    assert.equal(Object.hasOwn(result.body, 'data'), false)
  }
})

test('members HTTP: anonymous and inactive users receive no member data', async () => {
  const anonymous = await request({ userId: null })

  assert.equal(anonymous.status, 401)
  assert.equal(Object.hasOwn(anonymous.body, 'data'), false)

  const inactive = await request({
    userId: users.inactiveAccount,
  })

  assert.equal(inactive.status, 403)
  assert.equal(inactive.body.error.code, 'USER_INACTIVE')
  assert.equal(Object.hasOwn(inactive.body, 'data'), false)
})

test('members HTTP: foreign salon is denied and query cannot override selected salon', async () => {
  const foreign = await request({
    salonId: salonIds[2],
  })

  assert.equal(foreign.status, 403)
  assert.equal(foreign.body.error.code, 'SALON_ACCESS_DENIED')
  assert.equal(Object.hasOwn(foreign.body, 'data'), false)

  const spoofed = await request({
    query: `?salon_id=${salonIds[2]}&salonId=${salonIds[2]}`,
  })

  assert.equal(spoofed.status, 200)

  assert.ok(
    spoofed.body.data.members.every(
      (member) => Number(member.salon_id) === salonIds[0]
    )
  )

  assert.equal(
    spoofed.body.data.members.some(
      (member) => Number(member.user_id) === users.foreignOwner
    ),
    false
  )
})

test('members HTTP: multi-salon user must select a salon', async () => {
  const result = await request({ salonId: null })

  assert.equal(result.status, 409)
  assert.equal(
    result.body.error.code,
    'CURRENT_SALON_SELECTION_REQUIRED'
  )

  assert.equal(Object.hasOwn(result.body, 'data'), false)
})

test('members HTTP: revoked admin membership blocks the next request', async () => {
  await pool.query(
    `
      UPDATE salon_memberships
      SET active = false
      WHERE user_id = $1 AND salon_id = $2
    `,
    [users.admin, salonIds[0]]
  )

  try {
    const result = await request({
      userId: users.admin,
    })

    assert.equal(result.status, 403)
    assert.equal(result.body.error.code, 'SALON_ACCESS_DENIED')
    assert.equal(Object.hasOwn(result.body, 'data'), false)
  } finally {
    await pool.query(
      `
        UPDATE salon_memberships
        SET active = true
        WHERE user_id = $1 AND salon_id = $2
      `,
      [users.admin, salonIds[0]]
    )
  }
})