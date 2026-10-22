import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  createSalonInvitation,
  revokeSalonInvitation,
} from '../src/services/invitationManagementService.js'

import {
  hashInvitationToken,
} from '../src/services/invitationTokenService.js'

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

  try {
    for (const suffix of ['main', 'other']) {
      const result = await pool.query(
        `
          INSERT INTO salons (name, timezone)
          VALUES ($1, 'Europe/Zagreb')
          RETURNING id
        `,
        [`Invitation Management ${marker} ${suffix}`]
      )

      salonIds.push(Number(result.rows[0].id))
    }

    const [salonId, otherSalonId] = salonIds

    for (const suffix of ['owner', 'admin', 'employee', 'outsider']) {
      const result = await pool.query(
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
          `invitation-management-${marker}-${suffix}`,
          `${suffix}-${marker}@example.test`,
        ]
      )

      userIds.push(Number(result.rows[0].id))
    }

    const [
      ownerId,
      adminId,
      employeeUserId,
      outsiderId,
    ] = userIds

    const profileResult = await pool.query(
      `
        INSERT INTO employees (salon_id, name)
        VALUES
          ($1, 'Invitation Target'),
          ($1, 'Linked Employee'),
          ($2, 'Foreign Employee')
        RETURNING id, name
      `,
      [salonId, otherSalonId]
    )

    const profileId = (name) => Number(
      profileResult.rows.find(
        (row) => row.name === name
      ).id
    )

    const employeeId = profileId('Invitation Target')
    const linkedEmployeeId = profileId('Linked Employee')
    const foreignEmployeeId = profileId('Foreign Employee')

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
          ($3, $4, 'employee', $5)
      `,
      [
        ownerId,
        adminId,
        employeeUserId,
        salonId,
        linkedEmployeeId,
      ]
    )

    const create = (changes = {}) =>
      createSalonInvitation({
        salonId,
        actorUserId: ownerId,
        email: `recipient-${marker}@example.test`,
        role: 'employee',
        employeeId,
        ...changes,
      })

    const revoke = (invitationId, changes = {}) =>
      revokeSalonInvitation({
        salonId,
        actorUserId: ownerId,
        invitationId,
        ...changes,
      })

    await run({
      salonId,
      otherSalonId,
      ownerId,
      adminId,
      employeeUserId,
      outsiderId,
      employeeId,
      linkedEmployeeId,
      foreignEmployeeId,
      create,
      revoke,
    })
  } finally {
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

test('invitation management: owner creates employee invitation with hash only in database', async () => {
  await fixture(async ({ create, employeeId, ownerId }) => {
    const result = await create({
      email: '  Recipient.Name+tag@Example.Test  ',
    })

    assert.equal(
      result.invitation.email_normalized,
      'recipient.name+tag@example.test'
    )

    assert.equal(result.invitation.role, 'employee')
    assert.equal(Number(result.invitation.employee_id), employeeId)
    assert.equal(Number(result.invitation.created_by_user_id), ownerId)

    assert.equal(
      Object.hasOwn(result.invitation, 'token_hash'),
      false
    )

    const stored = await pool.query(
      `
        SELECT token_hash, created_at, expires_at
        FROM salon_invitations
        WHERE id = $1
      `,
      [result.invitation.id]
    )

    assert.equal(
      stored.rows[0].token_hash,
      hashInvitationToken(result.token)
    )

    assert.notEqual(
      stored.rows[0].token_hash,
      result.token
    )

    assert.equal(
      new Date(stored.rows[0].expires_at).getTime() -
        new Date(stored.rows[0].created_at).getTime(),
      7 * 24 * 60 * 60 * 1000
    )
  })
})

test('invitation management: admin can invite another admin without an employee profile', async () => {
  await fixture(async ({ create, adminId }) => {
    const result = await create({
      actorUserId: adminId,
      role: 'admin',
      employeeId: null,
    })

    assert.equal(result.invitation.role, 'admin')
    assert.equal(result.invitation.employee_id, null)
    assert.equal(Number(result.invitation.created_by_user_id), adminId)
  })
})

test('invitation management: employee and outsider cannot create or revoke invitations', async () => {
  await fixture(async ({
    create,
    revoke,
    employeeUserId,
    outsiderId,
    salonId,
  }) => {
    const original = await create()

    for (const actorUserId of [employeeUserId, outsiderId]) {
      await assert.rejects(
        () => create({ actorUserId }),
        {
          code: 'INVITATION_ISSUER_UNAUTHORIZED',
          statusCode: 403,
        }
      )

      await assert.rejects(
        () => revoke(original.invitation.id, { actorUserId }),
        {
          code: 'INVITATION_ISSUER_UNAUTHORIZED',
          statusCode: 403,
        }
      )
    }

    const result = await pool.query(
      `
        SELECT revoked_at
        FROM salon_invitations
        WHERE salon_id = $1
      `,
      [salonId]
    )

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].revoked_at, null)
  })
})

test('invitation management: invalid role, missing profile, foreign profile and linked profile are rejected', async () => {
  await fixture(async ({
    create,
    foreignEmployeeId,
    linkedEmployeeId,
  }) => {
    await assert.rejects(
      () => create({ role: 'owner' }),
      { code: 'INVALID_INVITATION_ROLE' }
    )

    await assert.rejects(
      () => create({ employeeId: null }),
      { code: 'INVITATION_EMPLOYEE_REQUIRED' }
    )

    await assert.rejects(
      () => create({ employeeId: foreignEmployeeId }),
      { code: 'INVITATION_EMPLOYEE_UNAVAILABLE' }
    )

    await assert.rejects(
      () => create({ employeeId: linkedEmployeeId }),
      { code: 'EMPLOYEE_ALREADY_LINKED' }
    )
  })
})

test('invitation management: duplicate open invitations are rejected and revocation permits a replacement', async () => {
  await fixture(async ({ create, revoke, ownerId }) => {
    const original = await create()

    await assert.rejects(
      () => create({
        role: 'admin',
        employeeId: null,
      }),
      { code: 'INVITATION_ALREADY_OPEN' }
    )

    await assert.rejects(
      () => create({
        email: 'different-recipient@example.test',
      }),
      { code: 'INVITATION_ALREADY_OPEN' }
    )

    const revoked = await revoke(original.invitation.id)

    assert.ok(revoked.revoked_at)
    assert.equal(Number(revoked.revoked_by_user_id), ownerId)
    assert.equal(Object.hasOwn(revoked, 'token_hash'), false)

    const repeated = await revoke(original.invitation.id)

    assert.equal(
      new Date(repeated.revoked_at).getTime(),
      new Date(revoked.revoked_at).getTime()
    )

    const replacement = await create()

    assert.notEqual(
      String(replacement.invitation.id),
      String(original.invitation.id)
    )

    assert.notEqual(replacement.token, original.token)
  })
})

test('invitation management: expired invitation must be revoked before replacement', async () => {
  await fixture(async ({ create, revoke }) => {
    const original = await create()

    await pool.query(
      `
        UPDATE salon_invitations
        SET
          created_at = CURRENT_TIMESTAMP - INTERVAL '2 days',
          expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
        WHERE id = $1
      `,
      [original.invitation.id]
    )

    await assert.rejects(
      () => create(),
      { code: 'INVITATION_ALREADY_OPEN' }
    )

    await revoke(original.invitation.id)

    const replacement = await create()

    assert.ok(replacement.invitation.id)
  })
})

test('invitation management: inactive issuer membership blocks both operations', async () => {
  await fixture(async ({
    create,
    revoke,
    ownerId,
    salonId,
  }) => {
    const original = await create()

    await pool.query(
      `
        UPDATE salon_memberships
        SET active = false
        WHERE user_id = $1 AND salon_id = $2
      `,
      [ownerId, salonId]
    )

    await assert.rejects(
      () => create(),
      { code: 'INVITATION_ISSUER_UNAUTHORIZED' }
    )

    await assert.rejects(
      () => revoke(original.invitation.id),
      { code: 'INVITATION_ISSUER_UNAUTHORIZED' }
    )
  })
})

test('invitation management: inactive salon and inactive employee block creation', async () => {
  await fixture(async ({
    create,
    employeeId,
    salonId,
  }) => {
    await pool.query(
      'UPDATE employees SET active = false WHERE id = $1',
      [employeeId]
    )

    await assert.rejects(
      () => create(),
      { code: 'INVITATION_EMPLOYEE_UNAVAILABLE' }
    )

    await pool.query(
      'UPDATE salons SET active = false WHERE id = $1',
      [salonId]
    )

    await assert.rejects(
      () => create({ role: 'admin', employeeId: null }),
      { code: 'INVITATION_SALON_UNAVAILABLE' }
    )
  })
})

test('invitation management: invitation cannot be revoked through another salon', async () => {
  await fixture(async ({
    create,
    revoke,
    otherSalonId,
    ownerId,
  }) => {
    const original = await create()

    await pool.query(
      `
        INSERT INTO salon_memberships (user_id, salon_id, role)
        VALUES ($1, $2, 'owner')
      `,
      [ownerId, otherSalonId]
    )

    await assert.rejects(
      () => revoke(original.invitation.id, {
        salonId: otherSalonId,
      }),
      {
        code: 'INVITATION_NOT_FOUND',
        statusCode: 404,
      }
    )

    const result = await pool.query(
      'SELECT revoked_at FROM salon_invitations WHERE id = $1',
      [original.invitation.id]
    )

    assert.equal(result.rows[0].revoked_at, null)
  })
})

test('invitation management: accepted invitation cannot be revoked', async () => {
  await fixture(async ({
    create,
    revoke,
    outsiderId,
  }) => {
    const original = await create()

    await pool.query(
      `
        UPDATE salon_invitations
        SET
          accepted_at = clock_timestamp(),
          accepted_by_user_id = $2
        WHERE id = $1
      `,
      [original.invitation.id, outsiderId]
    )

    await assert.rejects(
      () => revoke(original.invitation.id),
      { code: 'INVITATION_ALREADY_ACCEPTED' }
    )
  })
})

test('invitation management: concurrent duplicate creation produces one invitation', async () => {
  await fixture(async ({ create, salonId }) => {
    const results = await Promise.allSettled([
      create({ role: 'admin', employeeId: null }),
      create({ role: 'admin', employeeId: null }),
    ])

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1
    )

    const rejected = results.find(
      (result) => result.status === 'rejected'
    )

    assert.equal(
      rejected.reason.code,
      'INVITATION_ALREADY_OPEN'
    )

    const count = await pool.query(
      `
        SELECT COUNT(*)::integer AS count
        FROM salon_invitations
        WHERE salon_id = $1
      `,
      [salonId]
    )

    assert.equal(count.rows[0].count, 1)
  })
})