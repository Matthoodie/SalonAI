import {
  resolveSalonPermission,
  resolveAppointmentPermissionScope,
} from '../src/services/salonPermissionService.js'

import {
  getCurrentAuth,
} from '../src/controllers/authController.js'


import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  findMemberPermissionOverride,
} from '../src/repositories/salonMemberPermissionRepository.js'

const marker = `${Date.now()}-${process.pid}`
const salonIds = []
const userIds = []
const memberships = []

before(async () => {
  for (let index = 0; index < 2; index += 1) {
    const salon = await pool.query(
      `
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb')
        RETURNING id
      `,
      [`Member permissions ${marker}-${index}`]
    )

    salonIds.push(Number(salon.rows[0].id))
  }

  // Two employees in the first salon, one in the second.
  for (let index = 0; index < 3; index += 1) {
    const salonId = salonIds[index === 2 ? 1 : 0]

    const user = await pool.query(
      `
        INSERT INTO users (auth_provider, auth_subject, email)
        VALUES ('test', $1, $2)
        RETURNING id
      `,
      [
        `member-permissions-${marker}-${index}`,
        `member-permissions-${marker}-${index}@example.test`,
      ]
    )

    const userId = Number(user.rows[0].id)
    userIds.push(userId)

    const employee = await pool.query(
      `
        INSERT INTO employees (salon_id, name)
        VALUES ($1, $2)
        RETURNING id
      `,
      [salonId, `Permission employee ${index}`]
    )

    const membership = await pool.query(
      `
        INSERT INTO salon_memberships (
          user_id, salon_id, role, employee_id
        )
        VALUES ($1, $2, 'employee', $3)
        RETURNING id, salon_id, user_id, employee_id
      `,
      [userId, salonId, employee.rows[0].id]
    )

    memberships.push(membership.rows[0])
  }
})

after(async () => {
  try {
    if (salonIds.length) {
      await pool.query(
        'DELETE FROM salon_memberships WHERE salon_id = ANY($1::bigint[])',
        [salonIds]
      )

      await pool.query(
        'DELETE FROM salons WHERE id = ANY($1::bigint[])',
        [salonIds]
      )
    }

    if (userIds.length) {
      await pool.query(
        'DELETE FROM users WHERE id = ANY($1::bigint[])',
        [userIds]
      )
    }
  } finally {
    await pool.end()
  }
})

async function clearOverrides() {
  await pool.query(
    `
      DELETE FROM salon_member_permission_overrides
      WHERE salon_id = ANY($1::bigint[])
    `,
    [salonIds]
  )
}

async function insertOverride({
  membership = memberships[0],
  salonId = membership.salon_id,
  key = 'appointment.reschedule',
  value = 'self',
} = {}) {
  return pool.query(
    `
      INSERT INTO salon_member_permission_overrides (
        salon_id, membership_id, permission_key, permission_value
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [salonId, membership.id, key, value]
  )
}

function readOverride({
  membership = memberships[0],
  salonId = membership.salon_id,
  key = 'appointment.reschedule',
} = {}) {
  return findMemberPermissionOverride({
    salonId,
    membershipId: membership.id,
    permissionKey: key,
  })
}

test('member permissions: absent override returns null', async () => {
  await clearOverrides()

  assert.equal(await readOverride(), null)
})

test('member permissions: coworkers can have independent values', async () => {
  await clearOverrides()

  await insertOverride({
    membership: memberships[0],
    value: 'self',
  })

  await insertOverride({
    membership: memberships[1],
    value: 'deny',
  })

  assert.deepEqual(
    await readOverride({ membership: memberships[0] }),
    { permission_value: 'self' }
  )

  assert.deepEqual(
    await readOverride({ membership: memberships[1] }),
    { permission_value: 'deny' }
  )

  assert.equal(
    await readOverride({ membership: memberships[2] }),
    null
  )
})

test('member permissions: all four appointment keys are independent', async () => {
  await clearOverrides()

  const keys = [
    'appointment.create',
    'appointment.reschedule',
    'appointment.change_status',
    'appointment.change_client',
  ]

  for (const key of keys) {
    await insertOverride({ key, value: 'self' })
  }

  await pool.query(
    `
      UPDATE salon_member_permission_overrides
      SET permission_value = 'deny'
      WHERE membership_id = $1
        AND permission_key = 'appointment.change_status'
    `,
    [memberships[0].id]
  )

  for (const key of keys) {
    const result = await readOverride({ key })

    assert.equal(
      result.permission_value,
      key === 'appointment.change_status' ? 'deny' : 'self'
    )
  }
})

test('member permissions: database rejects all and unsupported keys', async () => {
  await clearOverrides()

  for (const value of ['all', 'direct', 'approval', 'SELF', '']) {
    await assert.rejects(
      () => insertOverride({ value }),
      {
        code: '23514',
        constraint: 'salon_member_permissions_value_check',
      }
    )
  }

  for (const key of [
    'calendar.view',
    'schedule.time_off',
    'membership.role',
    'unknown',
  ]) {
    await assert.rejects(
      () => insertOverride({ key }),
      {
        code: '23514',
        constraint: 'salon_member_permissions_key_check',
      }
    )
  }
})

test('member permissions: foreign salon linkage and duplicate key are rejected', async () => {
  await clearOverrides()

  await assert.rejects(
    () => insertOverride({ salonId: salonIds[1] }),
    {
      code: '23503',
      constraint: 'salon_member_permissions_same_salon_fkey',
    }
  )

  await insertOverride()

  await assert.rejects(
    () => insertOverride(),
    {
      code: '23505',
      constraint: 'salon_member_permissions_unique',
    }
  )

  assert.equal(
    await readOverride({ salonId: salonIds[1] }),
    null
  )
})

test('member permissions: inactive context and nonemployee roles do not return overrides', async () => {
  await clearOverrides()
  await insertOverride()

  const member = memberships[0]

  try {
    await pool.query(
      'UPDATE salon_memberships SET active = false WHERE id = $1',
      [member.id]
    )

    assert.equal(await readOverride(), null)

    await pool.query(
      'UPDATE salon_memberships SET active = true WHERE id = $1',
      [member.id]
    )

    for (const role of ['admin', 'owner']) {
      await pool.query(
        'UPDATE salon_memberships SET role = $2 WHERE id = $1',
        [member.id, role]
      )

      assert.equal(await readOverride(), null)
    }

    await pool.query(
      "UPDATE salon_memberships SET role = 'employee' WHERE id = $1",
      [member.id]
    )

    await pool.query(
      'UPDATE users SET active = false WHERE id = $1',
      [member.user_id]
    )

    assert.equal(await readOverride(), null)

    await pool.query(
      'UPDATE users SET active = true WHERE id = $1',
      [member.user_id]
    )

    await pool.query(
      'UPDATE salons SET active = false WHERE id = $1',
      [member.salon_id]
    )

    assert.equal(await readOverride(), null)
  } finally {
    await pool.query(
      `
        UPDATE salon_memberships
        SET role = 'employee', active = true
        WHERE id = $1
      `,
      [member.id]
    )

    await pool.query(
      'UPDATE users SET active = true WHERE id = $1',
      [member.user_id]
    )

    await pool.query(
      'UPDATE salons SET active = true WHERE id = $1',
      [member.salon_id]
    )
  }

  assert.deepEqual(await readOverride(), {
    permission_value: 'self',
  })
})

test('member permissions: deleting membership removes its overrides', async () => {
  await clearOverrides()

  const member = memberships[2]

  await insertOverride({ membership: member })

  await pool.query(
    'DELETE FROM salon_memberships WHERE id = $1',
    [member.id]
  )

  const result = await pool.query(
    `
      SELECT COUNT(*)::integer AS count
      FROM salon_member_permission_overrides
      WHERE membership_id = $1
    `,
    [member.id]
  )

  assert.equal(result.rows[0].count, 0)
})


test('member permissions resolver: individual grant affects only selected member and action', async () => {
  await clearOverrides()

  await insertOverride({
    key: 'appointment.reschedule',
    value: 'self',
  })

  for (const [index, expected] of [
    [0, 'self'],
    [1, 'deny'],
  ]) {
    const value = await resolveSalonPermission({
      salonId: salonIds[0],
      role: 'employee',
      membershipId: memberships[index].id,
      permissionKey: 'appointment.reschedule',
    })

    assert.equal(value, expected)
  }

  const unchanged = await resolveSalonPermission({
    salonId: salonIds[0],
    role: 'employee',
    membershipId: memberships[0].id,
    permissionKey: 'appointment.change_status',
  })

  assert.equal(unchanged, 'deny')
})

test('member permissions resolver: individual deny overrides default self and removal restores inheritance', async () => {
  await clearOverrides()

  await insertOverride({
    key: 'appointment.create',
    value: 'deny',
  })

  const resolve = () => resolveSalonPermission({
    salonId: salonIds[0],
    role: 'employee',
    membershipId: memberships[0].id,
    permissionKey: 'appointment.create',
  })

  assert.equal(await resolve(), 'deny')

  await clearOverrides()

  assert.equal(await resolve(), 'self')
})

test('member permissions resolver: individual value overrides salon role setting and removal restores it', async () => {
  await clearOverrides()

  await pool.query(
    `
      INSERT INTO salon_permission_overrides (
        salon_id, role, permission_key, permission_value
      )
      VALUES ($1, 'employee', 'appointment.reschedule', 'self')
    `,
    [salonIds[0]]
  )

  try {
    await insertOverride({
      key: 'appointment.reschedule',
      value: 'deny',
    })

    const resolve = () => resolveSalonPermission({
      salonId: salonIds[0],
      role: 'employee',
      membershipId: memberships[0].id,
      permissionKey: 'appointment.reschedule',
    })

    assert.equal(await resolve(), 'deny')

    await clearOverrides()

    assert.equal(await resolve(), 'self')
  } finally {
    await pool.query(
      `
        DELETE FROM salon_permission_overrides
        WHERE salon_id = $1
          AND role = 'employee'
          AND permission_key = 'appointment.reschedule'
      `,
      [salonIds[0]]
    )
  }
})

test('member permissions scope: individual grant remains limited to own employee identity', async () => {
  await clearOverrides()
  await insertOverride()

  const member = memberships[0]

  const scope = await resolveAppointmentPermissionScope({
    salonId: salonIds[0],
    membership: {
      id: member.id,
      salonId: member.salon_id,
      role: 'employee',
      employeeId: Number(member.employee_id),
      active: true,
    },
    permissionKey: 'appointment.reschedule',
  })

  assert.deepEqual(scope, {
    permissionValue: 'self',
    employeeId: Number(member.employee_id),
  })

  await assert.rejects(
    () => resolveAppointmentPermissionScope({
      salonId: salonIds[0],
      membership: {
        id: memberships[1].id,
        salonId: memberships[1].salon_id,
        role: 'employee',
        employeeId: Number(memberships[1].employee_id),
        active: true,
      },
      permissionKey: 'appointment.reschedule',
    }),
    {
      code: 'SALON_PERMISSION_DENIED',
      statusCode: 403,
    }
  )
})

test('member permissions auth: response exposes individual values and leaves coworker defaults unchanged', async () => {
  await clearOverrides()

  await insertOverride({
    key: 'appointment.reschedule',
    value: 'self',
  })

  await insertOverride({
    key: 'appointment.create',
    value: 'deny',
  })

  for (const index of [0, 1]) {
    const member = memberships[index]

    const userResult = await pool.query(
      `
        SELECT id, email, display_name, active
        FROM users
        WHERE id = $1
      `,
      [member.user_id]
    )

    const req = {
      currentUser: userResult.rows[0],

      currentSalon: {
        id: salonIds[0],
        name: 'Permission test salon',
        timezone: 'Europe/Zagreb',
        active: true,
      },

      currentMembership: {
        id: member.id,
        role: 'employee',
        employeeId: Number(member.employee_id),
        active: true,
      },
    }

    let statusCode
    let responseBody
    let nextError

    const res = {
      set() {
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

    await getCurrentAuth(req, res, (error) => {
      nextError = error
    })

    assert.equal(nextError, undefined)
    assert.equal(statusCode, 200)

    assert.deepEqual(responseBody.data.permissions, {
      'appointment.create': index === 0 ? 'deny' : 'self',
      'appointment.reschedule': index === 0 ? 'self' : 'deny',
      'appointment.change_status': 'deny',
      'appointment.change_client': 'deny',
    })
  }
})