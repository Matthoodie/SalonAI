import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  createInvitationToken,
} from '../src/services/invitationTokenService.js'

import {
  createInvitationAcceptanceService,
} from '../src/services/invitationAcceptanceService.js'

let sequence = 0

after(async () => {
  await pool.end()
})

async function fixture(run) {
  sequence += 1

  const marker = `${Date.now()}-${process.pid}-${sequence}`

  let salonId
  const userIds = []

  try {
    const salonResult = await pool.query(
      `
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb')
        RETURNING id
      `,
      [`Invitation Acceptance ${marker}`]
    )

    salonId = Number(salonResult.rows[0].id)

    for (const name of ['issuer', 'recipient', 'other']) {
      const result = await pool.query(
        `
          INSERT INTO users (
            auth_provider, auth_subject, email
          )
          VALUES ('clerk', $1, $2)
          RETURNING id
        `,
        [
          `${name}-${marker}`,
          `${name}-${marker}@example.test`,
        ]
      )

      userIds.push(Number(result.rows[0].id))
    }

    const [issuerId, recipientId, otherId] = userIds

    await pool.query(
      `
        INSERT INTO salon_memberships (user_id, salon_id, role)
        VALUES ($1, $2, 'owner')
      `,
      [issuerId, salonId]
    )

    const employeeResult = await pool.query(
      `
        INSERT INTO employees (salon_id, name)
        VALUES ($1, 'Invitation Recipient')
        RETURNING id
      `,
      [salonId]
    )

    const employeeId = Number(employeeResult.rows[0].id)
    const { token, tokenHash } = createInvitationToken()
    const email = `recipient-${marker}@example.test`

    const invitationResult = await pool.query(
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
          $1, $2, 'employee', $3, $4, $5,
          CURRENT_TIMESTAMP + INTERVAL '24 hours'
        )
        RETURNING id
      `,
      [salonId, email, employeeId, tokenHash, issuerId]
    )

    const invitationId = invitationResult.rows[0].id

    // Simuliramo samo vanjsku provjeru identiteta.
    // Sve DB provjere i transakcije ostaju stvarne.
    const accept = createInvitationAcceptanceService({
      verifyIdentity: async ({ currentUser, invitedEmail }) => {
        assert.equal(Number(currentUser.id), recipientId)
        assert.equal(invitedEmail, email)

        return {
          userId: recipientId,
          authSubject: currentUser.auth_subject,
          verifiedEmail: email,
        }
      },
    })

    await run({
      salonId,
      issuerId,
      recipientId,
      otherId,
      employeeId,
      invitationId,
      token,
      accept,
    })
  } finally {
    if (salonId) {
      await pool.query(
        'DELETE FROM salon_invitations WHERE salon_id = $1',
        [salonId]
      )

      await pool.query(
        'DELETE FROM salon_memberships WHERE salon_id = $1',
        [salonId]
      )

      await pool.query(
        'DELETE FROM salons WHERE id = $1',
        [salonId]
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

async function assertNotAccepted(context) {
  const invitation = await pool.query(
    `
      SELECT accepted_at, accepted_by_user_id
      FROM salon_invitations
      WHERE id = $1
    `,
    [context.invitationId]
  )

  assert.equal(invitation.rows[0].accepted_at, null)
  assert.equal(invitation.rows[0].accepted_by_user_id, null)
}

async function assertNoRecipientMembership(context) {
  const memberships = await pool.query(
    `
      SELECT id
      FROM salon_memberships
      WHERE user_id = $1 AND salon_id = $2
    `,
    [context.recipientId, context.salonId]
  )

  assert.equal(memberships.rowCount, 0)
}

test('invitation acceptance: creates membership and marks invitation together', async () => {
  await fixture(async (context) => {
    const result = await context.accept({
      currentUserId: context.recipientId,
      token: context.token,
    })

    assert.equal(result.membership.role, 'employee')
    assert.equal(
      Number(result.membership.employee_id),
      context.employeeId
    )
    assert.equal(
      Number(result.membership.salon_id),
      context.salonId
    )

    const invitation = await pool.query(
      `
        SELECT accepted_at, accepted_by_user_id
        FROM salon_invitations
        WHERE id = $1
      `,
      [context.invitationId]
    )

    assert.ok(invitation.rows[0].accepted_at)
    assert.equal(
      Number(invitation.rows[0].accepted_by_user_id),
      context.recipientId
    )

    await assert.rejects(
      () => context.accept({
        currentUserId: context.recipientId,
        token: context.token,
      }),
      { code: 'INVITATION_UNAVAILABLE' }
    )
  })
})

test('invitation acceptance: concurrent use creates exactly one membership', async () => {
  await fixture(async (context) => {
    const results = await Promise.allSettled([
      context.accept({
        currentUserId: context.recipientId,
        token: context.token,
      }),
      context.accept({
        currentUserId: context.recipientId,
        token: context.token,
      }),
    ])

    assert.equal(
      results.filter((item) => item.status === 'fulfilled').length,
      1
    )

    const rejected = results.find(
      (item) => item.status === 'rejected'
    )

    assert.equal(
      rejected.reason.code,
      'INVITATION_UNAVAILABLE'
    )

    const memberships = await pool.query(
      `
        SELECT id
        FROM salon_memberships
        WHERE user_id = $1 AND salon_id = $2
      `,
      [context.recipientId, context.salonId]
    )

    assert.equal(memberships.rowCount, 1)
  })
})

test('invitation acceptance: revoked and expired invitations create nothing', async () => {
  for (const state of ['revoked', 'expired']) {
    await fixture(async (context) => {
      if (state === 'revoked') {
        await pool.query(
          `
            UPDATE salon_invitations
            SET revoked_at = CURRENT_TIMESTAMP,
                revoked_by_user_id = $2
            WHERE id = $1
          `,
          [context.invitationId, context.issuerId]
        )
      } else {
        await pool.query(
          `
            UPDATE salon_invitations
            SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 days',
                expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
            WHERE id = $1
          `,
          [context.invitationId]
        )
      }

      await assert.rejects(
        () => context.accept({
          currentUserId: context.recipientId,
          token: context.token,
        }),
        { code: 'INVITATION_UNAVAILABLE' }
      )

      await assertNoRecipientMembership(context)
      await assertNotAccepted(context)
    })
  }
})

test('invitation acceptance: inactive existing membership is not changed', async () => {
  await fixture(async (context) => {
    await pool.query(
      `
        INSERT INTO salon_memberships (
          user_id, salon_id, role, active
        )
        VALUES ($1, $2, 'admin', false)
      `,
      [context.recipientId, context.salonId]
    )

    await assert.rejects(
      () => context.accept({
        currentUserId: context.recipientId,
        token: context.token,
      }),
      { code: 'SALON_MEMBERSHIP_ALREADY_EXISTS' }
    )

    const existing = await pool.query(
      `
        SELECT role, active, employee_id
        FROM salon_memberships
        WHERE user_id = $1 AND salon_id = $2
      `,
      [context.recipientId, context.salonId]
    )

    assert.equal(existing.rows[0].role, 'admin')
    assert.equal(existing.rows[0].active, false)
    assert.equal(existing.rows[0].employee_id, null)

    await assertNotAccepted(context)
  })
})

test('invitation acceptance: occupied employee profile is not reassigned', async () => {
  await fixture(async (context) => {
    await pool.query(
      `
        INSERT INTO salon_memberships (
          user_id, salon_id, role, employee_id
        )
        VALUES ($1, $2, 'employee', $3)
      `,
      [context.otherId, context.salonId, context.employeeId]
    )

    await assert.rejects(
      () => context.accept({
        currentUserId: context.recipientId,
        token: context.token,
      }),
      { code: 'EMPLOYEE_ALREADY_LINKED' }
    )

    await assertNoRecipientMembership(context)
    await assertNotAccepted(context)
  })
})

test('invitation acceptance: issuer permission removal prevents acceptance', async () => {
  await fixture(async (context) => {
    await pool.query(
      `
        UPDATE salon_memberships
        SET active = false
        WHERE user_id = $1 AND salon_id = $2
      `,
      [context.issuerId, context.salonId]
    )

    await assert.rejects(
      () => context.accept({
        currentUserId: context.recipientId,
        token: context.token,
      }),
      { code: 'INVITATION_ISSUER_UNAUTHORIZED' }
    )

    await assertNoRecipientMembership(context)
    await assertNotAccepted(context)
  })
})

test('invitation acceptance: unavailable salon or employee creates no membership', async () => {
  for (const target of ['salon', 'employee']) {
    await fixture(async (context) => {
      if (target === 'salon') {
        await pool.query(
          'UPDATE salons SET active = false WHERE id = $1',
          [context.salonId]
        )
      } else {
        await pool.query(
          'UPDATE employees SET active = false WHERE id = $1',
          [context.employeeId]
        )
      }

      await assert.rejects(
        () => context.accept({
          currentUserId: context.recipientId,
          token: context.token,
        }),
        {
          code: target === 'salon'
            ? 'INVITATION_SALON_UNAVAILABLE'
            : 'INVITATION_EMPLOYEE_UNAVAILABLE',
        }
      )

      await assertNoRecipientMembership(context)
      await assertNotAccepted(context)
    })
  }
})

test('invitation acceptance: identity failure leaves invitation and membership untouched', async () => {
  await fixture(async (context) => {
    const accept = createInvitationAcceptanceService({
      verifyIdentity: async () => {
        const error = new Error('Email does not match.')
        error.code = 'INVITATION_EMAIL_MISMATCH'
        throw error
      },
    })

    await assert.rejects(
      () => accept({
        currentUserId: context.recipientId,
        token: context.token,
      }),
      { code: 'INVITATION_EMAIL_MISMATCH' }
    )

    await assertNoRecipientMembership(context)
    await assertNotAccepted(context)
  })
})

test('invitation acceptance: administrator invitation requires issuer to remain owner', async () => {
  for (const issuerRole of ['owner', 'admin']) {
    await fixture(async (context) => {
      await pool.query(
        `
          UPDATE salon_invitations
          SET role = 'admin', employee_id = NULL
          WHERE id = $1
        `,
        [context.invitationId]
      )

      await pool.query(
        `
          UPDATE salon_memberships
          SET role = $3
          WHERE user_id = $1 AND salon_id = $2
        `,
        [
          context.issuerId,
          context.salonId,
          issuerRole,
        ]
      )

      if (issuerRole === 'owner') {
        const result = await context.accept({
          currentUserId: context.recipientId,
          token: context.token,
        })

        assert.equal(result.membership.role, 'admin')
        assert.equal(result.membership.employee_id, null)
      } else {
        await assert.rejects(
          () => context.accept({
            currentUserId: context.recipientId,
            token: context.token,
          }),
          {
            code: 'INVITATION_ISSUER_UNAUTHORIZED',
            statusCode: 403,
          }
        )

        await assertNoRecipientMembership(context)
        await assertNotAccepted(context)
      }
    })
  }
})

test('invitation acceptance: active admin can still sponsor an employee invitation', async () => {
  await fixture(async (context) => {
    await pool.query(
      `
        UPDATE salon_memberships
        SET role = 'admin'
        WHERE user_id = $1 AND salon_id = $2
      `,
      [context.issuerId, context.salonId]
    )

    const result = await context.accept({
      currentUserId: context.recipientId,
      token: context.token,
    })

    assert.equal(result.membership.role, 'employee')
    assert.equal(
      Number(result.membership.employee_id),
      context.employeeId
    )
  })
})