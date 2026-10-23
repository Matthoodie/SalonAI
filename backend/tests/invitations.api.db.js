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
        method = 'POST',
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
          method,
          headers,
          body: method === 'GET'
            ? undefined
            : JSON.stringify(body),
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

test('invitation HTTP: admin cannot create an admin invitation by spoofing owner fields', async () => {
  await fixture(async ({ create, users, salonId }) => {
    const result = await create(
      {
        role: 'admin',
        employee_id: null,
        actorUserId: users.owner.id,
        created_by_user_id: users.owner.id,
      },
      {
        userId: users.admin.id,
      }
    )

    assert.equal(result.status, 403)
    assert.equal(
      result.body.error.code,
      'INVITATION_OWNER_REQUIRED'
    )

    const stored = await pool.query(
      `
        SELECT COUNT(*)::integer AS count
        FROM salon_invitations
        WHERE salon_id = $1
      `,
      [salonId]
    )

    assert.equal(stored.rows[0].count, 0)
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

test('invitation HTTP: list requires authentication and owner or admin role', async () => {
  await fixture(async ({ request, users }) => {
    const anonymous = await request('', {
      method: 'GET',
      userId: null,
    })

    assert.equal(anonymous.status, 401)

    const employee = await request('', {
      method: 'GET',
      userId: users.employee.id,
    })

    assert.equal(employee.status, 403)
    assert.equal(
      employee.body.error.code,
      'INSUFFICIENT_SALON_ROLE'
    )

    const outsider = await request('', {
      method: 'GET',
      userId: users.outsider.id,
    })

    assert.equal(outsider.status, 403)

    for (const userId of [users.owner.id, users.admin.id]) {
      const allowed = await request('', {
        method: 'GET',
        userId,
      })

      assert.equal(allowed.status, 200)
      assert.deepEqual(allowed.body.data.invitations, [])
      assert.equal(allowed.body.data.next_before_id, null)
      assert.equal(
        allowed.headers.get('cache-control'),
        'no-store'
      )
    }
  })
})

test('invitation HTTP: list returns all lifecycle states without token material', async () => {
  await fixture(async ({ create, request, users }) => {
    const created = {}

    for (const status of [
      'pending',
      'expired',
      'accepted',
      'revoked',
    ]) {
      const result = await create({
        email: `${status}-${users.recipient.email}`,
        role: 'admin',
        employee_id: null,
      })

      assert.equal(result.status, 201)
      created[status] = result.body.data.invitation.id
    }

    await pool.query(
      `
        UPDATE salon_invitations
        SET
          created_at = CURRENT_TIMESTAMP - INTERVAL '2 days',
          expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
        WHERE id = $1
      `,
      [created.expired]
    )

    await pool.query(
      `
        UPDATE salon_invitations
        SET
          accepted_at = clock_timestamp(),
          accepted_by_user_id = $2
        WHERE id = $1
      `,
      [created.accepted, users.recipient.id]
    )

    const revoked = await request(
      `/${created.revoked}/revoke`
    )

    assert.equal(revoked.status, 200)

    const listed = await request('', {
      method: 'GET',
    })

    assert.equal(listed.status, 200)
    assert.equal(listed.body.data.invitations.length, 4)

    const expectedFields = [
      'id',
      'salon_id',
      'email_normalized',
      'role',
      'employee_id',
      'employee_name',
      'created_at',
      'expires_at',
      'accepted_at',
      'revoked_at',
      'status',
    ].sort()

    for (const [status, id] of Object.entries(created)) {
      const invitation = listed.body.data.invitations.find(
        (item) => String(item.id) === String(id)
      )

      assert.ok(invitation)
      assert.equal(invitation.status, status)
      assert.deepEqual(
        Object.keys(invitation).sort(),
        expectedFields
      )
    }
  })
})

test('invitation HTTP: list stays within selected salon and ignores query salon spoofing', async () => {
  await fixture(async ({
    create,
    request,
    salonId,
    otherSalonId,
  }) => {
    const first = await create({
      role: 'admin',
      employee_id: null,
    })

    const second = await create(
      {
        role: 'admin',
        employee_id: null,
      },
      {
        selectedSalonId: otherSalonId,
      }
    )

    assert.equal(first.status, 201)
    assert.equal(second.status, 201)

    const listed = await request(
      `?salon_id=${otherSalonId}`,
      {
        method: 'GET',
        selectedSalonId: salonId,
      }
    )

    assert.equal(listed.status, 200)
    assert.equal(listed.body.data.invitations.length, 1)

    assert.equal(
      String(listed.body.data.invitations[0].id),
      String(first.body.data.invitation.id)
    )

    assert.equal(
      Number(listed.body.data.invitations[0].salon_id),
      salonId
    )
  })
})

test('invitation HTTP: list paginates without duplicates and rejects invalid cursor', async () => {
  await fixture(async ({ request, salonId, users }) => {
    await pool.query(
      `
        INSERT INTO salon_invitations (
          salon_id,
          email_normalized,
          role,
          token_hash,
          created_by_user_id,
          expires_at
        )
        SELECT
          $1::bigint,
          'page-' || n || '@example.test',
          'admin',
          repeat(md5(($1::bigint)::text || ':' || n::text), 2),
          $2::bigint,
          CURRENT_TIMESTAMP + INTERVAL '7 days'
        FROM generate_series(1, 51) AS series(n)
      `,
      [salonId, users.owner.id]
    )

    const first = await request('', {
      method: 'GET',
    })

    assert.equal(first.status, 200)
    assert.equal(first.body.data.invitations.length, 50)
    assert.ok(first.body.data.next_before_id)

    const second = await request(
      `?before_id=${first.body.data.next_before_id}`,
      {
        method: 'GET',
      }
    )

    assert.equal(second.status, 200)
    assert.equal(second.body.data.invitations.length, 1)
    assert.equal(second.body.data.next_before_id, null)

    const ids = [
      ...first.body.data.invitations,
      ...second.body.data.invitations,
    ].map((item) => String(item.id))

    assert.equal(new Set(ids).size, 51)

    const invalid = await request('?before_id=abc', {
      method: 'GET',
    })

    assert.equal(invalid.status, 400)
    assert.equal(
      invalid.body.error.code,
      'INVALID_INVITATION_INPUT'
    )
  })
})

test('invitation HTTP: eligible profiles require authenticated owner or admin', async () => {
  await fixture(async ({ request, users, employeeId }) => {
    const anonymous = await request('/eligible-employees', {
      method: 'GET',
      userId: null,
    })

    assert.equal(anonymous.status, 401)

    const employee = await request('/eligible-employees', {
      method: 'GET',
      userId: users.employee.id,
    })

    assert.equal(employee.status, 403)
    assert.equal(
      employee.body.error.code,
      'INSUFFICIENT_SALON_ROLE'
    )

    const outsider = await request('/eligible-employees', {
      method: 'GET',
      userId: users.outsider.id,
    })

    assert.equal(outsider.status, 403)

    for (const userId of [users.owner.id, users.admin.id]) {
      const result = await request('/eligible-employees', {
        method: 'GET',
        userId,
      })

      assert.equal(result.status, 200)
      assert.equal(
        result.headers.get('cache-control'),
        'no-store'
      )

      assert.deepEqual(
        result.body.data.employees.map((item) => Number(item.id)),
        [employeeId]
      )

      assert.deepEqual(
        Object.keys(result.body.data.employees[0]).sort(),
        ['id', 'name']
      )
    }
  })
})

test('invitation HTTP: eligible profiles exclude foreign, inactive and linked profiles including inactive memberships', async () => {
  await fixture(async ({
    request,
    users,
    salonId,
    otherSalonId,
    employeeId,
  }) => {
    await pool.query(
      `
        INSERT INTO employees (salon_id, name, active)
        VALUES ($1, 'Inactive Invitation Profile', false)
      `,
      [salonId]
    )

    await pool.query(
      `
        UPDATE salon_memberships
        SET active = false
        WHERE user_id = $1 AND salon_id = $2
      `,
      [users.employee.id, salonId]
    )

    const result = await request(
      `/eligible-employees?salon_id=${otherSalonId}`,
      {
        method: 'GET',
        selectedSalonId: salonId,
      }
    )

    assert.equal(result.status, 200)

    assert.deepEqual(
      result.body.data.employees.map((item) => Number(item.id)),
      [employeeId]
    )
  })
})

test('invitation HTTP: open and expired invitations reserve profiles until revocation', async () => {
  await fixture(async ({
    create,
    request,
    employeeId,
  }) => {
    const created = await create()

    assert.equal(created.status, 201)

    const invitationId = created.body.data.invitation.id

    const pending = await request('/eligible-employees', {
      method: 'GET',
    })

    assert.equal(pending.status, 200)
    assert.deepEqual(pending.body.data.employees, [])

    await pool.query(
      `
        UPDATE salon_invitations
        SET
          created_at = CURRENT_TIMESTAMP - INTERVAL '2 days',
          expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
        WHERE id = $1
      `,
      [invitationId]
    )

    const expired = await request('/eligible-employees', {
      method: 'GET',
    })

    assert.equal(expired.status, 200)
    assert.deepEqual(expired.body.data.employees, [])

    const revoked = await request(
      `/${invitationId}/revoke`
    )

    assert.equal(revoked.status, 200)

    const availableAgain = await request('/eligible-employees', {
      method: 'GET',
    })

    assert.equal(availableAgain.status, 200)

    assert.deepEqual(
      availableAgain.body.data.employees.map(
        (item) => Number(item.id)
      ),
      [employeeId]
    )
  })
})

test('invitation HTTP: owner can grant admin membership through invitation acceptance', async () => {
  await fixture(async ({ create, request, users }) => {
    const created = await create({
      role: 'admin',
      employee_id: null,
    })

    assert.equal(created.status, 201)

    const accepted = await request('/accept', {
      userId: users.recipient.id,
      selectedSalonId: null,
      body: {
        token: created.body.data.token,
      },
    })

    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.data.membership.role, 'admin')
    assert.equal(
      accepted.body.data.membership.employee_id,
      null
    )
  })
})

test('invitation HTTP: admin cannot revoke admin invitation but owner can', async () => {
  await fixture(async ({ create, request, users }) => {
    const created = await create({
      role: 'admin',
      employee_id: null,
    })

    assert.equal(created.status, 201)

    const invitationId = created.body.data.invitation.id

    const denied = await request(
      `/${invitationId}/revoke`,
      { userId: users.admin.id }
    )

    assert.equal(denied.status, 403)
    assert.equal(
      denied.body.error.code,
      'INVITATION_OWNER_REQUIRED'
    )

    const stored = await pool.query(
      'SELECT revoked_at FROM salon_invitations WHERE id = $1',
      [invitationId]
    )

    assert.equal(stored.rows[0].revoked_at, null)

    const allowed = await request(
      `/${invitationId}/revoke`
    )

    assert.equal(allowed.status, 200)
    assert.ok(allowed.body.data.invitation.revoked_at)
  })
})