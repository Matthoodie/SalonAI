import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  setMemberPermission,
  setPermissionAdminDelegation,
} from '../src/services/salonPermissionManagementService.js'

let sequence = 0

after(async () => {
  await pool.end()
})

async function fixture(run) {
  const marker = `${Date.now()}-${process.pid}-${++sequence}`
  const salonIds = []
  const userIds = []
  const users = {}
  const members = {}

  try {
    for (const label of ['main', 'foreign']) {
      const result = await pool.query(
        `
          INSERT INTO salons (name, timezone)
          VALUES ($1, 'Europe/Zagreb')
          RETURNING id
        `,
        [`Permission management ${marker} ${label}`]
      )

      salonIds.push(Number(result.rows[0].id))
    }

    for (const label of [
      'owner',
      'admin',
      'employee',
      'coworker',
      'foreign',
    ]) {
      const result = await pool.query(
        `
          INSERT INTO users (auth_provider, auth_subject, email)
          VALUES ('test', $1, $2)
          RETURNING id
        `,
        [
          `permission-management-${marker}-${label}`,
          `${label}-${marker}@example.test`,
        ]
      )

      users[label] = Number(result.rows[0].id)
      userIds.push(users[label])

      const salonId =
        label === 'foreign' ? salonIds[1] : salonIds[0]

      const role =
        label === 'owner' || label === 'admin'
          ? label
          : 'employee'

      let employeeId = null

      if (role === 'employee') {
        const employee = await pool.query(
          `
            INSERT INTO employees (salon_id, name)
            VALUES ($1, $2)
            RETURNING id
          `,
          [salonId, `Permission profile ${label}`]
        )

        employeeId = employee.rows[0].id
      }

      const membership = await pool.query(
        `
          INSERT INTO salon_memberships (
            user_id, salon_id, role, employee_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [users[label], salonId, role, employeeId]
      )

      members[label] = membership.rows[0]
    }

    const salonId = salonIds[0]
    const defaultKey = 'appointment.reschedule'

    const set = (
      value,
      actor = 'owner',
      target = 'employee',
      key = defaultKey
    ) => setMemberPermission({
      salonId,
      actorUserId: users[actor],
      membershipId: members[target].id,
      permissionKey: key,
      value,
    })

    const delegate = (
      enabled,
      actor = 'owner',
      key = defaultKey
    ) => setPermissionAdminDelegation({
      salonId,
      actorUserId: users[actor],
      permissionKey: key,
      enabled,
    })

    const audit = async () => {
      const result = await pool.query(
        `
          SELECT *
          FROM salon_permission_changes
          WHERE salon_id = $1
          ORDER BY id
        `,
        [salonId]
      )

      return result.rows
    }

    const overrides = async () => {
      const result = await pool.query(
        `
          SELECT membership_id, permission_key, permission_value
          FROM salon_member_permission_overrides
          WHERE salon_id = $1
          ORDER BY id
        `,
        [salonId]
      )

      return result.rows
    }

    await run({
      salonId,
      users,
      members,
      set,
      delegate,
      audit,
      overrides,
    })
  } finally {
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
  }
}

test('permission management: owner grants denies and restores inheritance with audit', async () => {
  await fixture(async ({ set, audit, overrides, users }) => {
    await set('self')
    await set('deny')
    await set(null)

    assert.deepEqual(await overrides(), [])

    const rows = await audit()

    assert.equal(rows.length, 3)

    assert.deepEqual(
      rows.map((row) => [row.previous_value, row.next_value]),
      [
        [null, 'self'],
        ['self', 'deny'],
        ['deny', null],
      ]
    )

    for (const row of rows) {
      assert.equal(Number(row.actor_user_id), users.owner)
      assert.equal(Number(row.target_user_id), users.employee)
      assert.equal(row.actor_role, 'owner')
      assert.equal(row.action, 'member_override')
    }
  })
})

test('permission management: admin is denied without delegation', async () => {
  await fixture(async ({ set, audit, overrides }) => {
    await assert.rejects(
      () => set('self', 'admin'),
      { code: 'PERMISSION_ADMIN_DELEGATION_REQUIRED' }
    )

    assert.deepEqual(await overrides(), [])
    assert.deepEqual(await audit(), [])
  })
})

test('permission management: delegation is limited to its key and revocation blocks subsequent writes', async () => {
  await fixture(async ({ set, delegate, overrides, audit }) => {
    await delegate(true)
    await set('self', 'admin')

    await assert.rejects(
      () => set(
        'self',
        'admin',
        'employee',
        'appointment.change_status'
      ),
      { code: 'PERMISSION_ADMIN_DELEGATION_REQUIRED' }
    )

    await delegate(false)

    await assert.rejects(
      () => set('deny', 'admin'),
      { code: 'PERMISSION_ADMIN_DELEGATION_REQUIRED' }
    )

    const saved = await overrides()

    assert.equal(saved.length, 1)
    assert.equal(saved[0].permission_value, 'self')

    const rows = await audit()

    assert.equal(rows.length, 3)
    assert.equal(rows[1].actor_role, 'admin')
    assert.equal(rows[2].next_value, 'disabled')
  })
})

test('permission management: only owner can change delegation', async () => {
  await fixture(async ({ delegate, audit }) => {
    for (const enabled of [true, false]) {
      await assert.rejects(
        () => delegate(enabled, 'admin'),
        { code: 'PERMISSION_DELEGATION_OWNER_REQUIRED' }
      )
    }

    await assert.rejects(
      () => delegate(true, 'employee'),
      { code: 'PERMISSION_MANAGEMENT_FORBIDDEN' }
    )

    assert.deepEqual(await audit(), [])
  })
})

test('permission management: employee foreign actor and foreign target are rejected', async () => {
  await fixture(async ({ set, audit }) => {
    for (const actor of ['employee', 'foreign']) {
      await assert.rejects(
        () => set('self', actor),
        { code: 'PERMISSION_MANAGEMENT_FORBIDDEN' }
      )
    }

    await assert.rejects(
      () => set('self', 'owner', 'foreign'),
      { code: 'PERMISSION_TARGET_NOT_FOUND', statusCode: 404 }
    )

    assert.deepEqual(await audit(), [])
  })
})

test('permission management: self admin and owner targets cannot receive employee overrides', async () => {
  await fixture(async ({ set, delegate, audit }) => {
    await delegate(true)

    await assert.rejects(
      () => set('self', 'owner', 'owner'),
      { code: 'PERMISSION_SELF_CHANGE_FORBIDDEN' }
    )

    await assert.rejects(
      () => set('self', 'admin', 'admin'),
      { code: 'PERMISSION_SELF_CHANGE_FORBIDDEN' }
    )

    await assert.rejects(
      () => set('self', 'owner', 'admin'),
      { code: 'PERMISSION_TARGET_NOT_EMPLOYEE' }
    )

    await assert.rejects(
      () => set('self', 'admin', 'owner'),
      { code: 'PERMISSION_TARGET_NOT_EMPLOYEE' }
    )

    assert.equal((await audit()).length, 1)
  })
})

test('permission management: revoked actor and inactive target are checked from database', async () => {
  await fixture(async ({ set, delegate, members, audit }) => {
    await delegate(true)

    await pool.query(
      'UPDATE salon_memberships SET active = false WHERE id = $1',
      [members.admin.id]
    )

    await assert.rejects(
      () => set('self', 'admin'),
      { code: 'PERMISSION_MANAGEMENT_FORBIDDEN' }
    )

    await pool.query(
      'UPDATE salon_memberships SET active = false WHERE id = $1',
      [members.employee.id]
    )

    await assert.rejects(
      () => set('self'),
      { code: 'PERMISSION_TARGET_NOT_EMPLOYEE' }
    )

    assert.equal((await audit()).length, 1)
  })
})

test('permission management: invalid values and nonoperational keys are rejected', async () => {
  await fixture(async ({ set, delegate, audit }) => {
    for (const value of ['all', 'direct', true, undefined]) {
      await assert.rejects(
        () => set(value),
        { code: 'INVALID_MEMBER_PERMISSION_VALUE', statusCode: 400 }
      )
    }

    for (const key of [
      'membership.role',
      'calendar.view',
      'schedule.time_off',
    ]) {
      await assert.rejects(
        () => set('self', 'owner', 'employee', key),
        { code: 'PERMISSION_KEY_NOT_MANAGEABLE', statusCode: 400 }
      )

      await assert.rejects(
        () => delegate(true, 'owner', key),
        { code: 'PERMISSION_KEY_NOT_MANAGEABLE', statusCode: 400 }
      )
    }

    await assert.rejects(
      () => delegate('true'),
      { code: 'INVALID_PERMISSION_DELEGATION_VALUE', statusCode: 400 }
    )

    assert.deepEqual(await audit(), [])
  })
})

test('permission management: repeated and concurrent identical requests create one change', async () => {
  await fixture(async ({ set, delegate, audit }) => {
    assert.equal((await set(null)).changed, false)
    assert.equal((await delegate(false)).changed, false)

    const results = await Promise.all([
      set('self'),
      set('self'),
    ])

    assert.deepEqual(
      results.map((result) => result.changed).sort(),
      [false, true]
    )

    assert.equal((await set('self')).changed, false)

    await delegate(true)
    assert.equal((await delegate(true)).changed, false)

    assert.equal((await audit()).length, 2)
  })
})

test('permission management: configuring one employee does not alter coworkers', async () => {
  await fixture(async ({ set, members, overrides }) => {
    await set('self', 'owner', 'employee')
    await set('deny', 'owner', 'coworker')

    const rows = await overrides()

    assert.equal(rows.length, 2)

    const first = rows.find(
      (row) => String(row.membership_id) === String(members.employee.id)
    )

    const second = rows.find(
      (row) => String(row.membership_id) === String(members.coworker.id)
    )

    assert.equal(first.permission_value, 'self')
    assert.equal(second.permission_value, 'deny')
  })
})