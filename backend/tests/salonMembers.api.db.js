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

async function findTestMembership(label) {
  const result = await pool.query(
    `
      SELECT *
      FROM salon_memberships
      WHERE user_id = $1
        AND salon_id = $2
    `,
    [
      users[label],
      label === 'foreignOwner' ? salonIds[2] : salonIds[0],
    ]
  )

  assert.ok(result.rows[0])
  return result.rows[0]
}

async function patchTestMembership({
  membershipId,
  action,
  body,
  userId = users.owner,
  salonId = salonIds[0],
}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Salon-Id': String(salonId),
  }

  if (userId !== null) {
    headers['x-test-user-id'] = String(userId)
  }

  const response = await fetch(
    `${baseUrl}/api/members/${membershipId}/${action}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    }
  )

  return {
    status: response.status,
    body: await response.json(),
  }
}

async function readTestMemberAudit(membershipId) {
  const result = await pool.query(
    `
      SELECT *
      FROM salon_membership_changes
      WHERE salon_id = $1 AND membership_id = $2
      ORDER BY id
    `,
    [salonIds[0], membershipId]
  )

  return result.rows
}

test('members HTTP: owner changes role and audit uses authenticated actor', async () => {
  const member = await findTestMembership('employee')
  const before = await readTestMemberAudit(member.id)

  try {
    const promoted = await patchTestMembership({
      membershipId: member.id,
      action: 'role',
      body: {
        role: 'admin',
        actorUserId: users.foreignOwner,
        salon_id: salonIds[2],
        employee_id: null,
      },
    })

    assert.equal(promoted.status, 200)
    assert.equal(promoted.body.data.changed, true)
    assert.equal(promoted.body.data.membership.role, 'admin')
    assert.equal(
      promoted.body.data.membership.employee_id,
      member.employee_id
    )

    const demoted = await patchTestMembership({
      membershipId: member.id,
      action: 'role',
      body: { role: 'employee' },
    })

    assert.equal(demoted.status, 200)
    assert.equal(demoted.body.data.membership.role, 'employee')

    const audit = await readTestMemberAudit(member.id)
    const changes = audit.slice(before.length)

    assert.equal(changes.length, 2)

    for (const change of changes) {
      assert.equal(Number(change.actor_user_id), users.owner)
      assert.equal(Number(change.salon_id), salonIds[0])
      assert.equal(change.actor_role, 'owner')
    }

    assert.equal(changes[0].old_role, 'employee')
    assert.equal(changes[0].new_role, 'admin')
    assert.equal(changes[1].new_role, 'employee')
  } finally {
    await pool.query(
      'UPDATE salon_memberships SET role = $2 WHERE id = $1',
      [member.id, member.role]
    )
  }
})

test('members HTTP: admin cannot change roles even with owner fields in body', async () => {
  const member = await findTestMembership('employee')
  const before = await readTestMemberAudit(member.id)

  const result = await patchTestMembership({
    membershipId: member.id,
    action: 'role',
    userId: users.admin,
    body: {
      role: 'admin',
      actorUserId: users.owner,
      actor_role: 'owner',
    },
  })

  assert.equal(result.status, 403)
  assert.equal(
    result.body.error.code,
    'INSUFFICIENT_SALON_ROLE'
  )

  assert.equal(
    (await findTestMembership('employee')).role,
    'employee'
  )

  assert.equal(
    (await readTestMemberAudit(member.id)).length,
    before.length
  )
})

test('members HTTP: admin changes employee activity and next request loses salon access', async () => {
  const member = await findTestMembership('employee')

  try {
    const disabled = await patchTestMembership({
      membershipId: member.id,
      action: 'active',
      userId: users.admin,
      body: { active: false },
    })

    assert.equal(disabled.status, 200)
    assert.equal(disabled.body.data.membership.active, false)

    const blocked = await request({
      userId: users.employee,
    })

    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error.code, 'SALON_ACCESS_DENIED')

    const enabled = await patchTestMembership({
      membershipId: member.id,
      action: 'active',
      userId: users.admin,
      body: { active: true },
    })

    assert.equal(enabled.status, 200)
    assert.equal(enabled.body.data.membership.active, true)

    // Salon access is restored, but employees still cannot list members.
    const restricted = await request({
      userId: users.employee,
    })

    assert.equal(restricted.status, 403)
    assert.equal(
      restricted.body.error.code,
      'INSUFFICIENT_SALON_ROLE'
    )
  } finally {
    await pool.query(
      'UPDATE salon_memberships SET active = $2 WHERE id = $1',
      [member.id, member.active]
    )
  }
})

test('members HTTP: admin cannot reactivate another admin but owner can', async () => {
  const member = await findTestMembership('inactiveMembership')

  try {
    const denied = await patchTestMembership({
      membershipId: member.id,
      action: 'active',
      userId: users.admin,
      body: { active: true },
    })

    assert.equal(denied.status, 403)
    assert.equal(denied.body.error.code, 'MEMBER_OWNER_REQUIRED')

    const allowed = await patchTestMembership({
      membershipId: member.id,
      action: 'active',
      body: { active: true },
    })

    assert.equal(allowed.status, 200)
    assert.equal(allowed.body.data.membership.active, true)

    const revoked = await patchTestMembership({
      membershipId: member.id,
      action: 'active',
      body: { active: false },
    })

    assert.equal(revoked.status, 200)
    assert.equal(revoked.body.data.membership.active, false)
  } finally {
    await pool.query(
      'UPDATE salon_memberships SET active = $2 WHERE id = $1',
      [member.id, member.active]
    )
  }
})

test('members HTTP: anonymous and employee requests cannot change memberships', async () => {
  const member = await findTestMembership('admin')
  const before = await readTestMemberAudit(member.id)

  for (const action of ['role', 'active']) {
    const body =
      action === 'role'
        ? { role: 'employee' }
        : { active: false }

    const anonymous = await patchTestMembership({
      membershipId: member.id,
      action,
      body,
      userId: null,
    })

    assert.equal(anonymous.status, 401)

    const employee = await patchTestMembership({
      membershipId: member.id,
      action,
      body,
      userId: users.employee,
    })

    assert.equal(employee.status, 403)
    assert.equal(
      employee.body.error.code,
      'INSUFFICIENT_SALON_ROLE'
    )
  }

  const unchanged = await findTestMembership('admin')

  assert.equal(unchanged.role, member.role)
  assert.equal(unchanged.active, member.active)
  assert.equal(
    (await readTestMemberAudit(member.id)).length,
    before.length
  )
})

test('members HTTP: self change, owner target and foreign membership are rejected', async () => {
  const owner = await findTestMembership('owner')
  const foreign = await findTestMembership('foreignOwner')

  const self = await patchTestMembership({
    membershipId: owner.id,
    action: 'active',
    body: { active: false },
  })

  assert.equal(self.status, 403)
  assert.equal(self.body.error.code, 'MEMBER_SELF_CHANGE_FORBIDDEN')

  const protectedOwner = await patchTestMembership({
    membershipId: owner.id,
    action: 'active',
    userId: users.admin,
    body: { active: false },
  })

  assert.equal(protectedOwner.status, 403)
  assert.equal(
    protectedOwner.body.error.code,
    'MEMBER_OWNER_PROTECTED'
  )

  const foreignTarget = await patchTestMembership({
    membershipId: foreign.id,
    action: 'active',
    body: {
      active: false,
      salon_id: salonIds[2],
    },
  })

  assert.equal(foreignTarget.status, 404)
  assert.equal(foreignTarget.body.error.code, 'MEMBER_NOT_FOUND')

  assert.equal((await findTestMembership('owner')).active, true)
  assert.equal(
    (await findTestMembership('foreignOwner')).active,
    true
  )
})

test('members HTTP: invalid input and demotion without profile return clear errors', async () => {
  const member = await findTestMembership('admin')

  const cases = [
    {
      action: 'role',
      body: { role: 'owner' },
      status: 400,
      code: 'INVALID_MEMBER_ROLE',
    },
    {
      action: 'active',
      body: { active: 'false' },
      status: 400,
      code: 'INVALID_MEMBER_ACTIVE',
    },
    {
      action: 'role',
      body: { role: 'employee' },
      status: 409,
      code: 'MEMBER_EMPLOYEE_PROFILE_REQUIRED',
    },
  ]

  for (const entry of cases) {
    const result = await patchTestMembership({
      membershipId: member.id,
      action: entry.action,
      body: entry.body,
    })

    assert.equal(result.status, entry.status)
    assert.equal(result.body.error.code, entry.code)
  }

  const unchanged = await findTestMembership('admin')

  assert.equal(unchanged.role, member.role)
  assert.equal(unchanged.active, member.active)
})


test('member history HTTP: owner and admin receive only allowed history fields', async () => {
  const member = await findTestMembership('employee')

  // Create a real change through the API.
  try {
    const changed = await patchTestMembership({
      membershipId: member.id,
      action: 'active',
      body: { active: !member.active },
    })

    assert.equal(changed.status, 200)

    const expectedFields = [
      'id',
      'salon_id',
      'membership_id',
      'target_user_id',
      'actor_user_id',
      'actor_role',
      'action',
      'old_role',
      'new_role',
      'old_active',
      'new_active',
      'created_at',
      'actor_email',
      'actor_display_name',
      'target_email',
      'target_display_name',
    ].sort()

    for (const userId of [users.owner, users.admin]) {
      const result = await request({
        userId,
        query: '/history',
      })

      assert.equal(result.status, 200)
      assert.equal(
        result.headers.get('cache-control'),
        'no-store'
      )

      assert.ok(result.body.data.changes.length > 0)

      for (const change of result.body.data.changes) {
        assert.deepEqual(
          Object.keys(change).sort(),
          expectedFields
        )

        assert.equal(Number(change.salon_id), salonIds[0])
      }

      const latest = result.body.data.changes[0]

      assert.equal(Number(latest.membership_id), Number(member.id))
      assert.equal(Number(latest.actor_user_id), users.owner)
      assert.equal(Number(latest.target_user_id), users.employee)
      assert.equal(latest.actor_role, 'owner')
      assert.equal(latest.action, 'active')
      assert.equal(latest.old_active, member.active)
      assert.equal(latest.new_active, !member.active)
      assert.equal(typeof latest.actor_email, 'string')
      assert.equal(typeof latest.target_email, 'string')
    }
  } finally {
    await pool.query(
      'UPDATE salon_memberships SET active = $2 WHERE id = $1',
      [member.id, member.active]
    )
  }
})

test('member history HTTP: anonymous employee and inactive account cannot read history', async () => {
  for (const entry of [
    { userId: null, status: 401 },
    { userId: users.employee, status: 403 },
    { userId: users.inactiveAccount, status: 403 },
    { userId: users.inactiveMembership, status: 403 },
  ]) {
    const result = await request({
      userId: entry.userId,
      query: '/history',
    })

    assert.equal(result.status, entry.status)
    assert.equal(Object.hasOwn(result.body, 'data'), false)
  }
})

test('member history HTTP: selected salon controls history and query cannot spoof context', async () => {
  const foreign = await request({
    salonId: salonIds[2],
    query: '/history',
  })

  assert.equal(foreign.status, 403)
  assert.equal(foreign.body.error.code, 'SALON_ACCESS_DENIED')

  const spoofed = await request({
    query:
      `/history?salon_id=${salonIds[2]}` +
      `&actorUserId=${users.foreignOwner}`,
  })

  assert.equal(spoofed.status, 200)
  assert.ok(spoofed.body.data.changes.length > 0)

  assert.ok(
    spoofed.body.data.changes.every(
      (change) => Number(change.salon_id) === salonIds[0]
    )
  )

  const otherSalon = await request({
    userId: users.foreignOwner,
    salonId: salonIds[2],
    query: '/history',
  })

  assert.equal(otherSalon.status, 200)
  assert.deepEqual(otherSalon.body.data.changes, [])
  assert.equal(otherSalon.body.data.next_before_id, null)

  const employeeElsewhere = await request({
    userId: users.owner,
    salonId: salonIds[1],
    query: '/history',
  })

  assert.equal(employeeElsewhere.status, 403)
  assert.equal(
    employeeElsewhere.body.error.code,
    'INSUFFICIENT_SALON_ROLE'
  )
})

test('member history HTTP: cursor pagination has no duplicates and rejects invalid cursors', async () => {
  const member = await findTestMembership('employee')

  // Synthetic history rows are used only in this isolated test salon.
  const inserted = await pool.query(
    `
      INSERT INTO salon_membership_changes (
        salon_id,
        membership_id,
        target_user_id,
        actor_user_id,
        actor_role,
        action,
        old_role,
        new_role,
        old_active,
        new_active
      )
      SELECT
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::bigint,
        'owner',
        'active',
        'employee',
        'employee',
        true,
        false
      FROM generate_series(1, 55)
      RETURNING id
    `,
    [
      salonIds[0],
      member.id,
      users.employee,
      users.owner,
    ]
  )

  const seededIds = inserted.rows
    .map((row) => String(row.id))
    .sort((a, b) => Number(b) - Number(a))

  try {
    const first = await request({ query: '/history' })

    assert.equal(first.status, 200)
    assert.equal(first.body.data.changes.length, 50)

    const firstIds = first.body.data.changes.map(
      (row) => String(row.id)
    )

    assert.deepEqual(firstIds, seededIds.slice(0, 50))
    assert.equal(
      String(first.body.data.next_before_id),
      firstIds[firstIds.length - 1]
    )

    const second = await request({
      query:
        '/history?before_id=' +
        encodeURIComponent(first.body.data.next_before_id),
    })

    assert.equal(second.status, 200)

    const secondIds = second.body.data.changes.map(
      (row) => String(row.id)
    )

    assert.deepEqual(secondIds.slice(0, 5), seededIds.slice(50))

    const allIds = [...firstIds, ...secondIds]

    assert.equal(new Set(allIds).size, allIds.length)

    for (const cursor of [
      '',
      '0',
      '-1',
      '1.5',
      'abc',
      '9007199254740992',
    ]) {
      const invalid = await request({
        query: '/history?before_id=' + encodeURIComponent(cursor),
      })

      assert.equal(invalid.status, 400)
      assert.equal(
        invalid.body.error.code,
        'INVALID_MEMBER_HISTORY_CURSOR'
      )
    }
  } finally {
    await pool.query(
      'DELETE FROM salon_membership_changes WHERE id = ANY($1::bigint[])',
      [seededIds]
    )
  }
})

test('member history HTTP: revoked administrator loses history access on next request', async () => {
  const member = await findTestMembership('admin')

  try {
    const allowed = await request({
      userId: users.admin,
      query: '/history',
    })

    assert.equal(allowed.status, 200)

    const revoked = await patchTestMembership({
      membershipId: member.id,
      action: 'active',
      body: { active: false },
    })

    assert.equal(revoked.status, 200)

    const denied = await request({
      userId: users.admin,
      query: '/history',
    })

    assert.equal(denied.status, 403)
    assert.equal(denied.body.error.code, 'SALON_ACCESS_DENIED')
    assert.equal(Object.hasOwn(denied.body, 'data'), false)
  } finally {
    await pool.query(
      'UPDATE salon_memberships SET active = $2 WHERE id = $1',
      [member.id, member.active]
    )
  }
})