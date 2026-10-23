import pool from '../database/pool.js'

import {
  verifyInvitationIdentity,
} from './invitationIdentityService.js'

import {
  hashInvitationToken,
} from './invitationTokenService.js'

function fail(message, code, statusCode = 409) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

function unavailable() {
  return fail(
    'This invitation is no longer available.',
    'INVITATION_UNAVAILABLE',
    409
  )
}

export function createInvitationAcceptanceService({
  verifyIdentity = verifyInvitationIdentity,
} = {}) {
  return async function acceptInvitation({
    currentUserId,
    token,
  }) {
    const userId = Number(currentUserId)

    if (
      !['string', 'number'].includes(typeof currentUserId) ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw fail(
        'An authenticated user is required.',
        'INVITATION_AUTH_IDENTITY_REQUIRED',
        403
      )
    }

    const tokenHash = hashInvitationToken(token)

    const initialInvitation = await pool.query(
      `
        SELECT email_normalized
        FROM salon_invitations
        WHERE token_hash = $1
          AND accepted_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > clock_timestamp()
      `,
      [tokenHash]
    )

    if (!initialInvitation.rows[0]) {
      throw unavailable()
    }

    const initialUser = await pool.query(
      `
        SELECT id, auth_provider, auth_subject, email, active
        FROM users
        WHERE id = $1
      `,
      [userId]
    )

    const user = initialUser.rows[0]

    // Vanjski API poziv ne drži otvorenu DB transakciju.
    const identity = await verifyIdentity({
      currentUser: user,
      invitedEmail:
        initialInvitation.rows[0].email_normalized,
    })

    if (
      Number(identity?.userId) !== userId ||
      identity?.authSubject !== user?.auth_subject ||
      identity?.verifiedEmail !==
        initialInvitation.rows[0].email_normalized
    ) {
      throw fail(
        'Invitation identity verification failed.',
        'INVITATION_AUTH_IDENTITY_MISMATCH',
        403
      )
    }

    const db = await pool.connect()

    try {
      await db.query('BEGIN')

      const invitationResult = await db.query(
        `
          SELECT *
          FROM salon_invitations
          WHERE token_hash = $1
          FOR UPDATE
        `,
        [tokenHash]
      )

      const invitation = invitationResult.rows[0]

      if (
        !invitation ||
        invitation.accepted_at !== null ||
        invitation.revoked_at !== null
      ) {
        throw unavailable()
      }

      if (invitation.email_normalized !== identity.verifiedEmail) {
        throw fail(
          'The invitation email does not match the verified identity.',
          'INVITATION_EMAIL_MISMATCH',
          403
        )
      }

      const salonResult = await db.query(
        `
          SELECT id, active
          FROM salons
          WHERE id = $1
          FOR SHARE
        `,
        [invitation.salon_id]
      )

      if (salonResult.rows[0]?.active !== true) {
        throw fail(
          'The invitation salon is inactive.',
          'INVITATION_SALON_UNAVAILABLE',
          403
        )
      }

      const currentUserResult = await db.query(
        `
          SELECT id, auth_provider, auth_subject, active
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId]
      )

      const currentUser = currentUserResult.rows[0]

      if (
        !currentUser ||
        currentUser.active !== true ||
        currentUser.auth_provider !== 'clerk' ||
        currentUser.auth_subject !== identity.authSubject
      ) {
        throw fail(
          'The authenticated account is no longer available.',
          'INVITATION_AUTH_IDENTITY_REQUIRED',
          403
        )
      }

      const issuerResult = await db.query(
        `
          SELECT sm.id, sm.role
          FROM salon_memberships sm
          JOIN users u ON u.id = sm.user_id
          WHERE sm.user_id = $1
            AND sm.salon_id = $2
            AND sm.active = true
            AND sm.role IN ('owner', 'admin')
            AND u.active = true
          FOR SHARE OF sm, u
        `,
        [
          invitation.created_by_user_id,
          invitation.salon_id,
        ]
      )

      const issuer = issuerResult.rows[0]

      if (
        !issuer ||
        (
          invitation.role === 'admin' &&
          issuer.role !== 'owner'
        )
      ) {
        throw fail(
          'The invitation issuer no longer has permission.',
          'INVITATION_ISSUER_UNAUTHORIZED',
          403
        )
      }

      const existingMembership = await db.query(
        `
          SELECT id
          FROM salon_memberships
          WHERE user_id = $1 AND salon_id = $2
        `,
        [userId, invitation.salon_id]
      )

      if (existingMembership.rows[0]) {
        throw fail(
          'This account already has a membership in the salon.',
          'SALON_MEMBERSHIP_ALREADY_EXISTS'
        )
      }

      if (invitation.employee_id !== null) {
        const employeeResult = await db.query(
          `
            SELECT id, active
            FROM employees
            WHERE id = $1 AND salon_id = $2
            FOR UPDATE
          `,
          [
            invitation.employee_id,
            invitation.salon_id,
          ]
        )

        if (employeeResult.rows[0]?.active !== true) {
          throw fail(
            'The employee profile is unavailable.',
            'INVITATION_EMPLOYEE_UNAVAILABLE'
          )
        }

        const bindingResult = await db.query(
          `
            SELECT id
            FROM salon_memberships
            WHERE employee_id = $1
          `,
          [invitation.employee_id]
        )

        if (bindingResult.rows[0]) {
          throw fail(
            'The employee profile is already linked to an account.',
            'EMPLOYEE_ALREADY_LINKED'
          )
        }
      }

      const membershipResult = await db.query(
        `
          INSERT INTO salon_memberships (
            user_id,
            salon_id,
            role,
            employee_id,
            active
          )
          VALUES ($1, $2, $3, $4, true)
          RETURNING id, salon_id, role, employee_id, active
        `,
        [
          userId,
          invitation.salon_id,
          invitation.role,
          invitation.employee_id,
        ]
      )

      // Vrijeme provjeravamo ponovno nakon čekanja na zaključavanja.
      // Ista vremenska vrijednost koristi se za provjeru i zapis.
      const acceptedResult = await db.query(
        `
          WITH instant AS MATERIALIZED (
            SELECT clock_timestamp() AS value
          )
          UPDATE salon_invitations AS invitation
          SET accepted_at = instant.value,
              accepted_by_user_id = $2
          FROM instant
          WHERE invitation.id = $1
            AND invitation.accepted_at IS NULL
            AND invitation.revoked_at IS NULL
            AND invitation.expires_at > instant.value
          RETURNING invitation.id
        `,
        [invitation.id, userId]
      )

      if (!acceptedResult.rows[0]) {
        throw unavailable()
      }

      await db.query('COMMIT')

      return {
        invitationId: invitation.id,
        membership: membershipResult.rows[0],
      }
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})

      if (
        error.code === '23505' &&
        error.constraint === 'salon_memberships_user_salon_unique'
      ) {
        throw fail(
          'This account already has a membership in the salon.',
          'SALON_MEMBERSHIP_ALREADY_EXISTS'
        )
      }

      if (
        error.code === '23505' &&
        error.constraint === 'salon_memberships_employee_id_unique'
      ) {
        throw fail(
          'The employee profile is already linked to an account.',
          'EMPLOYEE_ALREADY_LINKED'
        )
      }

      throw error
    } finally {
      db.release()
    }
  }
}

export const acceptSalonInvitation =
  createInvitationAcceptanceService()