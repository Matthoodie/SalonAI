import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  updateSalonMemberRole,
  updateSalonMemberActive,
} from '../src/services/salonMemberManagementService.js'

let sequence = 0

after(async () => {
  await pool.end()
})

async function fixture(run) {
  const marker = `${Date.now()}-${process.pid}-${++sequence}`
  const salonIds = []
  const userIds = []
  const members = {}
  const users = {}

  try {
    for (const suffix of ['main', 'foreign']) {
      const result = await pool.query(
        `
          INSERT INTO salons (name, timezone)
          VALUES ($1, 'Europe/Zagreb')
          RETURNING id
        `,
        [`Member management ${marker} ${suffix}`]
      )

      salonIds.push(Number(result.rows[0].id))
    }

    for (const label of [
      'owner',
      'admin',
      'employee',
      'otherOwner',
      'foreign',
    ]) {
      const userResult = await pool.query(
        `
          INSERT INTO users (auth_provider, auth_subject, email)
          VALUES ('test', $1, $2)
          RETURNING id
        `,
        [
          `member-management-${marker}-${label}`,
          `${label.toLowerCase()}-${marker}@example.test`,
        ]
      )

      const userId = Number(userResult.rows[0].id)
      userIds.push(userId)
      users[label] = userId

      const salonId =
        label === 'foreign' ? salonIds[1] : salonIds[0]

      let employeeId = null

      if (label === 'employee' || label === 'foreign') {
        const employeeResult = await pool.query(
          `
            INSERT INTO employees (salon_id, name)
            VALUES ($1, $2)
            RETURNING id
          `,
          [salonId, `Profile ${label}`]
        )

        employeeId = Number(employeeResult.rows[0].id)
      }

      const role =
        label === 'owner' || label === 'otherOwner'
          ? 'owner'
          : label === 'admin'
            ? 'admin'
            : 'employee'

      const memberResult = await pool.query(
        `
          INSERT INTO salon_memberships (
            user_id, salon_id, role, employee_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [userId, salonId, role, employeeId]
      )

      members[label] = memberResult.rows[0]
    }

    const salonId = salonIds[0]

    const role = (label, value, actor = 'owner') =>
      updateSalonMemberRole({
        salonId,
        actorUserId: users[actor],
        membershipId: members[label].id,
        role: value,
      })

    const active = (label, value, actor = 'owner') =>
      updateSalonMemberActive({
        salonId,
        actorUserId: users[actor],
        membershipId: members[label].id,
        active: value,
      })

    const audit = async () => {
      const result = await pool.query(
        `
          SELECT *
          FROM salon_membership_changes
          WHERE salon_id = $1
          ORDER BY id
        `,
        [salonId]
      )

      return result.rows
    }

    const read = async (label) => {
      const result = await pool.query(
        'SELECT * FROM salon_memberships WHERE id = $1',
        [members[label].id]
      )

      return result.rows[0]
    }

    await run({
      salonId,
      users,
      members,
      role,
      active,
      audit,
      read,
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

test('member management: owner promotes and demotes with profile preserved and audit recorded', async () => {
  await fixture(async ({ role, members, users, audit }) => {
    const promoted = await role('employee', 'admin')

    assert.equal(promoted.changed, true)
    assert.equal(promoted.membership.role, 'admin')
    assert.equal(
      promoted.membership.employee_id,
      members.employee.employee_id
    )

    const demoted = await role('employee', 'employee')

    assert.equal(demoted.membership.role, 'employee')
    assert.equal(demoted.membership.active, true)
    assert.equal(
      demoted.membership.employee_id,
      members.employee.employee_id
    )

    const changes = await audit()

    assert.equal(changes.length, 2)
    assert.equal(Number(changes[0].actor_user_id), users.owner)
    assert.equal(changes[0].actor_role, 'owner')
    assert.equal(changes[0].old_role, 'employee')
    assert.equal(changes[0].new_role, 'admin')
    assert.equal(changes[1].old_role, 'admin')
    assert.equal(changes[1].new_role, 'employee')
  })
})

test('member management: admin cannot change roles or manage admin activity', async () => {
  await fixture(async ({ role, active, audit, read }) => {
    await assert.rejects(
      () => role('employee', 'admin', 'admin'),
      { code: 'MEMBER_OWNER_REQUIRED', statusCode: 403 }
    )

    await role('employee', 'admin')

    await assert.rejects(
      () => role('employee', 'employee', 'admin'),
      { code: 'MEMBER_OWNER_REQUIRED' }
    )

    await assert.rejects(
      () => active('employee', false, 'admin'),
      { code: 'MEMBER_OWNER_REQUIRED' }
    )

    await active('employee', false)

    await assert.rejects(
      () => active('employee', true, 'admin'),
      { code: 'MEMBER_OWNER_REQUIRED' }
    )

    assert.equal((await read('employee')).active, false)
    assert.equal((await audit()).length, 2)
  })
})

test('member management: admin and owner can change employee activity', async () => {
  await fixture(async ({ active, audit, read, users }) => {
    await active('employee', false, 'admin')
    await active('employee', true, 'admin')
    await active('employee', false, 'owner')
    await active('employee', true, 'owner')

    assert.equal((await read('employee')).active, true)

    const changes = await audit()

    assert.equal(changes.length, 4)
    assert.equal(Number(changes[0].actor_user_id), users.admin)
    assert.equal(changes[0].old_active, true)
    assert.equal(changes[0].new_active, false)
    assert.equal(changes[1].new_active, true)
    assert.equal(changes[2].actor_role, 'owner')
  })
})

test('member management: owner can change admin activity', async () => {
  await fixture(async ({ active, audit }) => {
    assert.equal(
      (await active('admin', false)).membership.active,
      false
    )

    assert.equal(
      (await active('admin', true)).membership.active,
      true
    )

    assert.equal((await audit()).length, 2)
  })
})

test('member management: own membership and other owner are protected', async () => {
  await fixture(async ({ role, active, audit }) => {
    for (const actor of ['owner', 'admin']) {
      await assert.rejects(
        () => role(actor, 'employee', actor),
        { code: 'MEMBER_SELF_CHANGE_FORBIDDEN' }
      )

      await assert.rejects(
        () => active(actor, false, actor),
        { code: 'MEMBER_SELF_CHANGE_FORBIDDEN' }
      )

      await assert.rejects(
        () => role('otherOwner', 'admin', actor),
        { code: 'MEMBER_OWNER_PROTECTED' }
      )

      await assert.rejects(
        () => active('otherOwner', false, actor),
        { code: 'MEMBER_OWNER_PROTECTED' }
      )
    }

    assert.equal((await audit()).length, 0)
  })
})

test('member management: admin without employee profile cannot be demoted', async () => {
  await fixture(async ({ role, read, audit }) => {
    await assert.rejects(
      () => role('admin', 'employee'),
      {
        code: 'MEMBER_EMPLOYEE_PROFILE_REQUIRED',
        statusCode: 409,
      }
    )

    assert.equal((await read('admin')).role, 'admin')
    assert.equal((await audit()).length, 0)
  })
})

test('member management: employee and foreign actor cannot manage members', async () => {
  await fixture(async ({ role, active, audit }) => {
    for (const actor of ['employee', 'foreign']) {
      await assert.rejects(
        () => role('admin', 'employee', actor),
        { code: 'MEMBER_ACTOR_FORBIDDEN' }
      )

      await assert.rejects(
        () => active('admin', false, actor),
        { code: 'MEMBER_ACTOR_FORBIDDEN' }
      )
    }

    await assert.rejects(
      () => active('foreign', false),
      { code: 'MEMBER_NOT_FOUND', statusCode: 404 }
    )

    assert.equal((await audit()).length, 0)
  })
})

test('member management: revoked actor membership and inactive account are rechecked', async () => {
  await fixture(async ({ active, members, users, audit }) => {
    await pool.query(
      'UPDATE salon_memberships SET active = false WHERE id = $1',
      [members.admin.id]
    )

    await assert.rejects(
      () => active('employee', false, 'admin'),
      { code: 'MEMBER_ACTOR_FORBIDDEN' }
    )

    await pool.query(
      'UPDATE salon_memberships SET active = true WHERE id = $1',
      [members.admin.id]
    )

    await pool.query(
      'UPDATE users SET active = false WHERE id = $1',
      [users.admin]
    )

    await assert.rejects(
      () => active('employee', false, 'admin'),
      { code: 'MEMBER_ACTOR_FORBIDDEN' }
    )

    assert.equal((await audit()).length, 0)
  })
})

test('member management: invalid inputs and inactive salon make no changes', async () => {
  await fixture(async ({ role, active, salonId, users, members, audit }) => {
    await assert.rejects(
      () => role('employee', 'owner'),
      { code: 'INVALID_MEMBER_ROLE', statusCode: 400 }
    )

    await assert.rejects(
      () => active('employee', 'false'),
      { code: 'INVALID_MEMBER_ACTIVE', statusCode: 400 }
    )

    await assert.rejects(
      () => updateSalonMemberActive({
        salonId,
        actorUserId: users.owner,
        membershipId: true,
        active: false,
      }),
      { code: 'INVALID_MEMBER_INPUT', statusCode: 400 }
    )

    await pool.query(
      'UPDATE salons SET active = false WHERE id = $1',
      [salonId]
    )

    await assert.rejects(
      () => active('employee', false),
      { code: 'MEMBER_SALON_UNAVAILABLE' }
    )

    assert.equal((await audit()).length, 0)
    assert.equal(members.employee.active, true)
  })
})

test('member management: repeated and concurrent identical changes produce one audit event', async () => {
  await fixture(async ({ active, audit }) => {
    const results = await Promise.all([
      active('employee', false),
      active('employee', false),
    ])

    assert.deepEqual(
      results.map((result) => result.changed).sort(),
      [false, true]
    )

    const repeated = await active('employee', false)

    assert.equal(repeated.changed, false)
    assert.equal((await audit()).length, 1)
  })
})

test('member management: membership reactivation does not reactivate user or employee profile', async () => {
  await fixture(async ({ active, users, members }) => {
    await active('employee', false)

    await pool.query(
      'UPDATE users SET active = false WHERE id = $1',
      [users.employee]
    )

    await pool.query(
      'UPDATE employees SET active = false WHERE id = $1',
      [members.employee.employee_id]
    )

    await active('employee', true)

    const user = await pool.query(
      'SELECT active FROM users WHERE id = $1',
      [users.employee]
    )

    const employee = await pool.query(
      'SELECT active FROM employees WHERE id = $1',
      [members.employee.employee_id]
    )

    assert.equal(user.rows[0].active, false)
    assert.equal(employee.rows[0].active, false)
  })
})