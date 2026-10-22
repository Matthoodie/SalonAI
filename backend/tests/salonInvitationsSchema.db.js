import test, {
  before,
  beforeEach,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  createInvitationToken,
} from '../src/services/invitationTokenService.js'

const fixtureToken = `${Date.now()}-${process.pid}`

const salonIds = []

let userId
let employeeId
let foreignEmployeeId
let sequence = 0

before(async () => {
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
      `invitation-schema-${fixtureToken}`,
      `invitation-schema-${fixtureToken}@example.test`,
    ]
  )

  userId = Number(userResult.rows[0].id)

  for (let index = 0; index < 2; index += 1) {
    const salonResult = await pool.query(
      `
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb')
        RETURNING id
      `,
      [`Invitation Schema ${fixtureToken}-${index}`]
    )

    salonIds.push(Number(salonResult.rows[0].id))
  }

  const ownEmployee = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Invitation Employee')
      RETURNING id
    `,
    [salonIds[0]]
  )

  employeeId = Number(ownEmployee.rows[0].id)

  const foreignEmployee = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Foreign Invitation Employee')
      RETURNING id
    `,
    [salonIds[1]]
  )

  foreignEmployeeId = Number(foreignEmployee.rows[0].id)
})

beforeEach(async () => {
  await pool.query(
    `
      DELETE FROM salon_invitations
      WHERE salon_id = ANY($1::bigint[])
    `,
    [salonIds]
  )
})

after(async () => {
  try {
    if (salonIds.length > 0) {
      await pool.query(
        `
          DELETE FROM salon_invitations
          WHERE salon_id = ANY($1::bigint[])
        `,
        [salonIds]
      )

      await pool.query(
        'DELETE FROM salons WHERE id = ANY($1::bigint[])',
        [salonIds]
      )
    }

    if (userId) {
      await pool.query(
        'DELETE FROM users WHERE id = $1',
        [userId]
      )
    }
  } finally {
    await pool.end()
  }
})

async function insertInvitation(options = {}) {
  sequence += 1

  const values = {
    email: `member-${sequence}@example.test`,
    role: 'employee',
    employeeId,
    tokenHash: createInvitationToken().tokenHash,
    ...options,
  }

  const result = await pool.query(
    `
      INSERT INTO salon_invitations (
        salon_id,
        email_normalized,
        role,
        employee_id,
        token_hash,
        created_by_user_id,
        expires_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        CURRENT_TIMESTAMP + INTERVAL '24 hours'
      )
      RETURNING *
    `,
    [
      salonIds[0],
      values.email,
      values.role,
      values.employeeId,
      values.tokenHash,
      userId,
    ]
  )

  return result.rows[0]
}

test('invitation schema: accepts employee and unlinked admin invitations', async () => {
  const employeeInvitation = await insertInvitation()

  const adminInvitation = await insertInvitation({
    role: 'admin',
    employeeId: null,
  })

  assert.equal(employeeInvitation.role, 'employee')
  assert.equal(
    Number(employeeInvitation.employee_id),
    employeeId
  )

  assert.equal(adminInvitation.role, 'admin')
  assert.equal(adminInvitation.employee_id, null)

  assert.equal(employeeInvitation.accepted_at, null)
  assert.equal(employeeInvitation.revoked_at, null)
  assert.equal(Object.hasOwn(employeeInvitation, 'token'), false)
})

test('invitation schema: rejects owner role and employee without profile', async () => {
  await assert.rejects(
    () => insertInvitation({ role: 'owner' }),
    {
      code: '23514',
      constraint: 'salon_invitations_role_check',
    }
  )

  await assert.rejects(
    () => insertInvitation({ employeeId: null }),
    {
      code: '23514',
      constraint: 'salon_invitations_employee_required_check',
    }
  )
})

test('invitation schema: rejects employee from another salon', async () => {
  await assert.rejects(
    () => insertInvitation({
      employeeId: foreignEmployeeId,
    }),
    {
      code: '23503',
      constraint: 'salon_invitations_employee_same_salon_fkey',
    }
  )
})

test('invitation schema: open email and employee are unique and revocation releases them', async () => {
  const first = await insertInvitation({
    email: 'same@example.test',
  })

  await assert.rejects(
    () => insertInvitation({
      email: 'same@example.test',
      role: 'admin',
      employeeId: null,
    }),
    {
      code: '23505',
      constraint: 'salon_invitations_open_email_unique',
    }
  )

  await assert.rejects(
    () => insertInvitation({
      email: 'different@example.test',
    }),
    {
      code: '23505',
      constraint: 'salon_invitations_open_employee_unique',
    }
  )

  await pool.query(
    `
      UPDATE salon_invitations
      SET revoked_at = CURRENT_TIMESTAMP,
          revoked_by_user_id = $2
      WHERE id = $1
    `,
    [first.id, userId]
  )

  const replacement = await insertInvitation({
    email: 'same@example.test',
  })

  assert.notEqual(replacement.id, first.id)
})

test('invitation schema: rejects malformed email and token hash', async () => {
  for (const email of [
    'Member@example.test',
    ' member@example.test',
    'not-an-email',
    '',
  ]) {
    await assert.rejects(
      () => insertInvitation({ email }),
      {
        code: '23514',
        constraint: 'salon_invitations_email_check',
      }
    )
  }

  await assert.rejects(
    () => insertInvitation({ tokenHash: 'invalid' }),
    {
      code: '23514',
      constraint: 'salon_invitations_token_hash_check',
    }
  )

  const first = await insertInvitation()

  await assert.rejects(
    () => insertInvitation({
      role: 'admin',
      employeeId: null,
      tokenHash: first.token_hash,
    }),
    {
      code: '23505',
      constraint: 'salon_invitations_token_hash_unique',
    }
  )
})

test('invitation schema: acceptance requires actor and valid time and excludes revocation', async () => {
  const invitation = await insertInvitation()

  await assert.rejects(
    () => pool.query(
      `
        UPDATE salon_invitations
        SET accepted_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [invitation.id]
    ),
    {
      code: '23514',
      constraint: 'salon_invitations_acceptance_pair_check',
    }
  )

  await assert.rejects(
    () => pool.query(
      `
        UPDATE salon_invitations
        SET accepted_at = expires_at,
            accepted_by_user_id = $2
        WHERE id = $1
      `,
      [invitation.id, userId]
    ),
    {
      code: '23514',
      constraint: 'salon_invitations_acceptance_time_check',
    }
  )

  await pool.query(
    `
      UPDATE salon_invitations
      SET accepted_at = CURRENT_TIMESTAMP,
          accepted_by_user_id = $2
      WHERE id = $1
    `,
    [invitation.id, userId]
  )

  await assert.rejects(
    () => pool.query(
      `
        UPDATE salon_invitations
        SET revoked_at = CURRENT_TIMESTAMP,
            revoked_by_user_id = $2
        WHERE id = $1
      `,
      [invitation.id, userId]
    ),
    {
      code: '23514',
      constraint: 'salon_invitations_terminal_state_check',
    }
  )
})