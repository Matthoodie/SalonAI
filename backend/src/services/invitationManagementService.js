import pool from '../database/pool.js'

import {
  normalizeInvitationEmail,
} from './invitationIdentityService.js'

import {
  createInvitationToken,
} from './invitationTokenService.js'

function fail(message, code, statusCode = 409) {
  const error = new Error(message)

  error.code = code
  error.statusCode = statusCode

  return error
}

function positiveId(value, field) {
  const validType =
    typeof value === 'number' ||
    typeof value === 'string'

  const text = validType
    ? String(value)
    : ''

  const number = Number(text)

  if (
    !/^[1-9]\d*$/.test(text) ||
    !Number.isSafeInteger(number)
  ) {
    throw fail(
      `${field} must be a positive integer.`,
      'INVALID_INVITATION_INPUT',
      400
    )
  }

  return number
}

async function assertIssuer(db, salonId, actorUserId) {
  const salonResult = await db.query(
    `
      SELECT id, active
      FROM salons
      WHERE id = $1
      FOR SHARE
    `,
    [salonId]
  )

  if (salonResult.rows[0]?.active !== true) {
    throw fail(
      'The selected salon is unavailable.',
      'INVITATION_SALON_UNAVAILABLE',
      403
    )
  }

  const result = await db.query(
    `
      SELECT sm.id
      FROM salon_memberships sm
      JOIN users u
        ON u.id = sm.user_id
      WHERE sm.user_id = $1
        AND sm.salon_id = $2
        AND sm.active = true
        AND sm.role IN ('owner', 'admin')
        AND u.active = true
      FOR SHARE OF sm, u
    `,
    [actorUserId, salonId]
  )

  if (!result.rows[0]) {
    throw fail(
      'Your salon role does not allow managing invitations.',
      'INVITATION_ISSUER_UNAUTHORIZED',
      403
    )
  }
}

function mapInvitation(row) {
  return {
    id: row.id,
    salon_id: row.salon_id,
    email_normalized: row.email_normalized,
    role: row.role,
    employee_id: row.employee_id,
    created_by_user_id: row.created_by_user_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    accepted_by_user_id: row.accepted_by_user_id,
    revoked_at: row.revoked_at,
    revoked_by_user_id: row.revoked_by_user_id,
  }
}

export async function createSalonInvitation({
  salonId,
  actorUserId,
  email,
  role,
  employeeId = null,
}) {
  const numericSalonId = positiveId(salonId, 'salonId')
  const numericActorId = positiveId(actorUserId, 'actorUserId')
  const normalizedEmail = normalizeInvitationEmail(email)

  if (!['employee', 'admin'].includes(role)) {
    throw fail(
      'Invitations support employee and admin roles only.',
      'INVALID_INVITATION_ROLE',
      400
    )
  }

  const numericEmployeeId =
    employeeId === null
      ? null
      : positiveId(employeeId, 'employeeId')

  if (role === 'employee' && numericEmployeeId === null) {
    throw fail(
      'An employee invitation requires an employee profile.',
      'INVITATION_EMPLOYEE_REQUIRED',
      400
    )
  }

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    await assertIssuer(
      db,
      numericSalonId,
      numericActorId
    )

    if (numericEmployeeId !== null) {
      const employeeResult = await db.query(
        `
          SELECT id, active
          FROM employees
          WHERE id = $1
            AND salon_id = $2
          FOR UPDATE
        `,
        [numericEmployeeId, numericSalonId]
      )

      if (employeeResult.rows[0]?.active !== true) {
        throw fail(
          'The employee profile is unavailable in this salon.',
          'INVITATION_EMPLOYEE_UNAVAILABLE'
        )
      }

      const membershipResult = await db.query(
        `
          SELECT id
          FROM salon_memberships
          WHERE employee_id = $1
          LIMIT 1
        `,
        [numericEmployeeId]
      )

      if (membershipResult.rows[0]) {
        throw fail(
          'This employee profile is already linked to a user.',
          'EMPLOYEE_ALREADY_LINKED'
        )
      }
    }

    const {
      token,
      tokenHash,
    } = createInvitationToken()

    const result = await db.query(
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
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          CURRENT_TIMESTAMP + INTERVAL '7 days'
        )
        RETURNING *
      `,
      [
        numericSalonId,
        normalizedEmail,
        role,
        numericEmployeeId,
        tokenHash,
        numericActorId,
      ]
    )

    await db.query('COMMIT')

    return {
      invitation: mapInvitation(result.rows[0]),
      token,
    }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})

    if (
      error.code === '23505' &&
      [
        'salon_invitations_open_email_unique',
        'salon_invitations_open_employee_unique',
      ].includes(error.constraint)
    ) {
      throw fail(
        'An open invitation already exists for this email or employee. Revoke it before creating another.',
        'INVITATION_ALREADY_OPEN'
      )
    }

    throw error
  } finally {
    db.release()
  }
}

export async function revokeSalonInvitation({
  salonId,
  actorUserId,
  invitationId,
}) {
  const numericSalonId = positiveId(salonId, 'salonId')
  const numericActorId = positiveId(actorUserId, 'actorUserId')
  const numericInvitationId = positiveId(invitationId, 'invitationId')

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const invitationResult = await db.query(
      `
        SELECT *
        FROM salon_invitations
        WHERE id = $1
          AND salon_id = $2
        FOR UPDATE
      `,
      [numericInvitationId, numericSalonId]
    )

    await assertIssuer(
      db,
      numericSalonId,
      numericActorId
    )

    const invitation = invitationResult.rows[0]

    if (!invitation) {
      throw fail(
        'Invitation not found in this salon.',
        'INVITATION_NOT_FOUND',
        404
      )
    }

    if (invitation.accepted_at !== null) {
      throw fail(
        'An accepted invitation cannot be revoked.',
        'INVITATION_ALREADY_ACCEPTED'
      )
    }

    if (invitation.revoked_at !== null) {
      await db.query('COMMIT')

      return mapInvitation(invitation)
    }

    const result = await db.query(
      `
        UPDATE salon_invitations
        SET
          revoked_at = clock_timestamp(),
          revoked_by_user_id = $2
        WHERE id = $1
        RETURNING *
      `,
      [numericInvitationId, numericActorId]
    )

    await db.query('COMMIT')

    return mapInvitation(result.rows[0])
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}

export async function listSalonInvitations({
  salonId,
  actorUserId,
  beforeId,
}) {
  const numericSalonId = positiveId(salonId, 'salonId')
  const numericActorId = positiveId(actorUserId, 'actorUserId')

  const numericBeforeId =
    beforeId === undefined
      ? null
      : positiveId(beforeId, 'beforeId')

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    await assertIssuer(
      db,
      numericSalonId,
      numericActorId
    )

    const result = await db.query(
      `
        SELECT
          i.id,
          i.salon_id,
          i.email_normalized,
          i.role,
          i.employee_id,
          e.name AS employee_name,
          i.created_at,
          i.expires_at,
          i.accepted_at,
          i.revoked_at,
          CASE
            WHEN i.accepted_at IS NOT NULL THEN 'accepted'
            WHEN i.revoked_at IS NOT NULL THEN 'revoked'
            WHEN i.expires_at <= CURRENT_TIMESTAMP THEN 'expired'
            ELSE 'pending'
          END AS status
        FROM salon_invitations i
        LEFT JOIN employees e
          ON e.id = i.employee_id
          AND e.salon_id = i.salon_id
        WHERE i.salon_id = $1
          AND ($2::bigint IS NULL OR i.id < $2)
        ORDER BY i.id DESC
        LIMIT 51
      `,
      [numericSalonId, numericBeforeId]
    )

    const invitations = result.rows.slice(0, 50)
    const hasMore = result.rows.length > 50

    await db.query('COMMIT')

    return {
      invitations,
      next_before_id: hasMore
        ? invitations[invitations.length - 1].id
        : null,
    }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}

export async function listInvitationEligibleEmployees({
  salonId,
  actorUserId,
}) {
  const numericSalonId = positiveId(salonId, 'salonId')
  const numericActorId = positiveId(actorUserId, 'actorUserId')

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    await assertIssuer(
      db,
      numericSalonId,
      numericActorId
    )

    const result = await db.query(
      `
        SELECT
          e.id,
          e.name
        FROM employees e
        WHERE e.salon_id = $1
          AND e.active = true

          AND NOT EXISTS (
            SELECT 1
            FROM salon_memberships sm
            WHERE sm.employee_id = e.id
          )

          AND NOT EXISTS (
            SELECT 1
            FROM salon_invitations i
            WHERE i.salon_id = e.salon_id
              AND i.employee_id = e.id
              AND i.accepted_at IS NULL
              AND i.revoked_at IS NULL
          )

        ORDER BY e.name, e.id
      `,
      [numericSalonId]
    )

    await db.query('COMMIT')

    return result.rows
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}