import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  createApp,
} from '../src/createApp.js'

import {
  createInvitationRouter,
} from '../src/routes/invitationRoutes.js'

import {
  createInvitationAcceptanceService,
} from '../src/services/invitationAcceptanceService.js'

after(async () => {
  await pool.end()
})

let sequence = 0

async function fixture(run) {
  sequence += 1

  const marker =
    `${Date.now()}-${process.pid}-${sequence}`

  const salonIds = []
  const userIds = []

  let server = null

  try {
    for (const label of ['main', 'other']) {
      const result = await pool.query(
        `
          INSERT INTO salons (name, timezone)
          VALUES ($1, 'Europe/Zagreb')
          RETURNING id
        `,
        [`Invitation HTTP ${marker} ${label}`]
      )

      salonIds.push(Number(result.rows[0].id))
    }

    const [salonId, otherSalonId] = salonIds

    const users = {}

    for (const label of [
      'owner',
      'admin',
      'employee',
      'recipient',
      'outsider',
    ]) {
      const result = await pool.query(
        `
          INSERT INTO users (
            auth_provider,
            auth_subject,
            email
          )
          VALUES ('clerk', $1, $2)
          RETURNING *
        `,
        [
          `invitation-http-${marker}-${label}`,
          `${label}-${marker}@example.test`,
        ]
      )

      users[label] = result.rows[0]
      userIds.push(Number(result.rows[0].id))
    }

    const employees = await pool.query(
      `
        INSERT INTO employees (salon_id, name)
        VALUES
          ($1, 'HTTP Invitation Target'),
          ($1, 'HTTP Acting Employee'),
          ($2, 'HTTP Foreign Employee')
        RETURNING id, name
      `,
      [salonId, otherSalonId]
    )

    const profileId = (name) => Number(
      employees.rows.find((row) => row.name === name).id
    )

    const employeeId = profileId('HTTP Invitation Target')
    const actingEmployeeId = profileId('HTTP Acting Employee')
    const foreignEmployeeId = profileId('HTTP Foreign Employee')

    await pool.query(
      `
        INSERT INTO salon_memberships (
          user_id,
          salon_id,
          role,
          employee_id
        )
        VALUES
          ($1, $4, 'owner', NULL),
          ($2, $4, 'admin', NULL),
          ($3, $4, 'employee', $5),
          ($1, $6, 'owner', NULL)
      `,
      [
        users.owner.id,
        users.admin.id,
        users.employee.id,
        salonId,
        actingEmployeeId,
        otherSalonId,
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
              message: 'Authentication is required.',
            },
          })
        }

        const result = await pool.query(
          'SELECT * FROM users WHERE id = $1 AND active = true',
          [rawId]
        )

        if (!result.rows[0]) {
          return res.status(401).json({
            error: {
              code: 'UNAUTHENTICATED',
              message: 'Authentication is required.',
            },
          })
        }

        req.currentUser = result.rows[0]
        return next()
      } catch (error) {
        return next(error)
      }
    }

    const acceptInvitation =
      createInvitationAcceptanceService({
        verifyIdentity: async ({
          currentUser,
          invitedEmail,
        }) => {
          // Test-only replacement for the external Clerk lookup.
          // Production uses verifyInvitationIdentity.
          const expectedRecipient = users.recipient

          if (
            String(currentUser?.id) !==
              String(expectedRecipient.id) ||
            invitedEmail !== expectedRecipient.email
          ) {
            const error = new Error(
              'The verified email does not match this invitation.'
            )

            error.code = 'INVITATION_EMAIL_MISMATCH'
            error.statusCode = 403

            throw error
          }

          return {
            userId: Number(currentUser.id),
            authSubject: currentUser.auth_subject,
            verifiedEmail: expectedRecipient.email,
          }
        },
      })

    const app = createApp({
      invitationRouter: createInvitationRouter({
        authenticate: authenticateTestUser,
        acceptInvitation,
      }),
    })

    server = app.listen(0, '127.0.0.1')

    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })

    const baseUrl =
      `http://127.0.0.1:${server.address().port}`

    async function request(
      path,
      {
        userId = users.owner.id,
        selectedSalonId = salonId,
        body = {},
      } = {}
    ) {
      const headers = {
        'Content-Type': 'application/json',
      }

      if (userId !== null) {
        headers['x-test-user-id'] = String(userId)
      }

      if (selectedSalonId !== null) {
        headers['X-Salon-Id'] = String(selectedSalonId)
      }

      const response = await fetch(
        `${baseUrl}/api/invitations${path}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }
      )

      return {
        status: response.status,
        headers: response.headers,
        body: await response.json(),
      }
    }

    const create = (bodyChanges = {}, options = {}) =>
      request('', {
        ...options,
        body: {
          email: users.recipient.email,
          role: 'employee',
          employee_id: employeeId,
          ...bodyChanges,
        },
      })

    await run({
      request,
      create,
      users,
      salonId,
      otherSalonId,
      employeeId,
      foreignEmployeeId,
    })
  } finally {
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

    if (salonIds.length > 0) {
      await pool.query(
        'DELETE FROM salon_invitations WHERE salon_id = ANY($1::bigint[])',
        [salonIds]
      )

      await pool.query(
        'DELETE FROM salon_memberships WHERE salon_id = ANY($1::bigint[])',
        [salonIds]
      )

      await pool.query(
        'DELETE FROM salons WHERE id = ANY($1::bigint[])',
        [salonIds]
      )
    }

    if (userIds.length > 0) {
      await pool.query(
        'DELETE FROM users WHERE id = ANY($1::bigint[])',
        [userIds]
      )
    }
  }
}

test('invitation HTTP: all invitation actions require authentication', async () => {
  await fixture(async ({ request, create }) => {
    const created = await create()

    assert.equal(created.status, 201)

    for (const path of [
      '',
      '/accept',
      `/${created.body.data.invitation.id}/revoke`,
    ]) {
      const result = await request(path, {
        userId: null,
        body: {
          token: created.body.data.token,
        },
      })

      assert.equal(result.status, 401)
      assert.equal(result.body.error.code, 'UNAUTHENTICATED')
      assert.equal(result.headers.get('cache-control'), 'no-store')
    }
  })
})

test('invitation HTTP: creation uses selected salon and authenticated actor, ignoring body spoofing', async () => {
  await fixture(async ({
    create,
    users,
    salonId,
    otherSalonId,
  }) => {
    const result = await create({
      salon_id: otherSalonId,
      salonId: otherSalonId,
      actorUserId: users.outsider.id,
      created_by_user_id: users.outsider.id,
    })

    assert.equal(result.status, 201)

    const { invitation, token } = result.body.data

    assert.equal(Number(invitation.salon_id), salonId)
    assert.equal(
      String(invitation.created_by_user_id),
      String(users.owner.id)
    )

    assert.match(token, /^[0-9a-f]{64}$/)
    assert.equal(Object.hasOwn(invitation, 'token_hash'), false)
    assert.equal(result.headers.get('cache-control'), 'no-store')
  })
})

test('invitation HTTP: admin can create an admin invitation', async () => {
  await fixture(async ({ create, users }) => {
    const result = await create(
      {
        role: 'admin',
        employee_id: null,
      },
      {
        userId: users.admin.id,
      }
    )

    assert.equal(result.status, 201)
    assert.equal(result.body.data.invitation.role, 'admin')
    assert.equal(result.body.data.invitation.employee_id, null)
  })
})

test('invitation HTTP: employee cannot create or revoke invitations', async () => {
  await fixture(async ({ create, request, users }) => {
    const original = await create()

    assert.equal(original.status, 201)

    const creation = await create({}, {
      userId: users.employee.id,
    })

    assert.equal(creation.status, 403)
    assert.equal(
      creation.body.error.code,
      'INSUFFICIENT_SALON_ROLE'
    )

    const revocation = await request(
      `/${original.body.data.invitation.id}/revoke`,
      {
        userId: users.employee.id,
      }
    )

    assert.equal(revocation.status, 403)
    assert.equal(
      revocation.body.error.code,
      'INSUFFICIENT_SALON_ROLE'
    )

    const stored = await pool.query(
      'SELECT revoked_at FROM salon_invitations WHERE id = $1',
      [original.body.data.invitation.id]
    )

    assert.equal(stored.rows[0].revoked_at, null)
  })
})

test('invitation HTTP: recipient without membership can accept and cannot reuse token', async () => {
  await fixture(async ({
    create,
    request,
    users,
    employeeId,
    salonId,
  }) => {
    const original = await create()

    assert.equal(original.status, 201)

    const before = await pool.query(
      'SELECT id FROM salon_memberships WHERE user_id = $1',
      [users.recipient.id]
    )

    assert.equal(before.rows.length, 0)

    const result = await request('/accept', {
      userId: users.recipient.id,
      selectedSalonId: null,
      body: {
        token: original.body.data.token,
        role: 'owner',
        employee_id: null,
        currentUserId: users.owner.id,
      },
    })

    assert.equal(result.status, 200)
    assert.equal(result.body.data.membership.role, 'employee')
    assert.equal(
      Number(result.body.data.membership.employee_id),
      employeeId
    )
    assert.equal(
      Number(result.body.data.membership.salon_id),
      salonId
    )

    const stored = await pool.query(
      `
        SELECT user_id, role
        FROM salon_memberships
        WHERE id = $1
      `,
      [result.body.data.membership.id]
    )

    assert.equal(
      String(stored.rows[0].user_id),
      String(users.recipient.id)
    )

    const repeated = await request('/accept', {
      userId: users.recipient.id,
      selectedSalonId: null,
      body: {
        token: original.body.data.token,
      },
    })

    assert.equal(repeated.status, 409)
    assert.equal(
      repeated.body.error.code,
      'INVITATION_UNAVAILABLE'
    )
  })
})

test('invitation HTTP: wrong recipient cannot impersonate invited user through body', async () => {
  await fixture(async ({ create, request, users }) => {
    const original = await create()

    assert.equal(original.status, 201)

    const result = await request('/accept', {
      userId: users.outsider.id,
      selectedSalonId: null,
      body: {
        token: original.body.data.token,
        currentUserId: users.recipient.id,
        user_id: users.recipient.id,
        email: users.recipient.email,
      },
    })

    assert.equal(result.status, 403)
    assert.equal(
      result.body.error.code,
      'INVITATION_EMAIL_MISMATCH'
    )

    const stored = await pool.query(
      `
        SELECT accepted_at
        FROM salon_invitations
        WHERE id = $1
      `,
      [original.body.data.invitation.id]
    )

    assert.equal(stored.rows[0].accepted_at, null)
  })
})

test('invitation HTTP: admin revocation prevents subsequent acceptance', async () => {
  await fixture(async ({ create, request, users }) => {
    const original = await create()

    assert.equal(original.status, 201)

    const revoked = await request(
      `/${original.body.data.invitation.id}/revoke`,
      {
        userId: users.admin.id,
      }
    )

    assert.equal(revoked.status, 200)
    assert.ok(revoked.body.data.invitation.revoked_at)
    assert.equal(
      String(revoked.body.data.invitation.revoked_by_user_id),
      String(users.admin.id)
    )

    assert.equal(
      Object.hasOwn(revoked.body.data.invitation, 'token_hash'),
      false
    )

    const acceptance = await request('/accept', {
      userId: users.recipient.id,
      selectedSalonId: null,
      body: {
        token: original.body.data.token,
      },
    })

    assert.equal(acceptance.status, 409)
    assert.equal(
      acceptance.body.error.code,
      'INVITATION_UNAVAILABLE'
    )
  })
})

test('invitation HTTP: selecting another salon cannot revoke the original invitation', async () => {
  await fixture(async ({
    create,
    request,
    otherSalonId,
  }) => {
    const original = await create()

    assert.equal(original.status, 201)

    const result = await request(
      `/${original.body.data.invitation.id}/revoke`,
      {
        selectedSalonId: otherSalonId,
      }
    )

    assert.equal(result.status, 404)
    assert.equal(
      result.body.error.code,
      'INVITATION_NOT_FOUND'
    )

    const stored = await pool.query(
      'SELECT revoked_at FROM salon_invitations WHERE id = $1',
      [original.body.data.invitation.id]
    )

    assert.equal(stored.rows[0].revoked_at, null)
  })
})

test('invitation HTTP: owner invitation and foreign employee profile are rejected', async () => {
  await fixture(async ({ create, foreignEmployeeId }) => {
    const ownerInvite = await create({
      role: 'owner',
    })

    assert.equal(ownerInvite.status, 400)
    assert.equal(
      ownerInvite.body.error.code,
      'INVALID_INVITATION_ROLE'
    )

    const foreignEmployee = await create({
      employee_id: foreignEmployeeId,
    })

    assert.equal(foreignEmployee.status, 409)
    assert.equal(
      foreignEmployee.body.error.code,
      'INVITATION_EMPLOYEE_UNAVAILABLE'
    )
  })
})

test('invitation HTTP: malformed token is rejected without creating membership', async () => {
  await fixture(async ({ request, users }) => {
    const result = await request('/accept', {
      userId: users.recipient.id,
      selectedSalonId: null,
      body: {
        token: 'invalid-token',
      },
    })

    assert.equal(result.status, 400)
    assert.equal(
      result.body.error.code,
      'INVALID_INVITATION_TOKEN'
    )

    const memberships = await pool.query(
      'SELECT id FROM salon_memberships WHERE user_id = $1',
      [users.recipient.id]
    )

    assert.equal(memberships.rows.length, 0)
  })
})