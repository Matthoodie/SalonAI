import pool from '../database/pool.js'

function fail(message, code, statusCode) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

function positiveId(value, code) {
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw fail('The identifier is invalid.', code, 400)
  }

  return Number(value)
}

export async function getSalonMemberHistory({
  salonId,
  actorUserId,
  beforeId,
}) {
  const salon = positiveId(
    salonId,
    'INVALID_MEMBER_HISTORY_INPUT'
  )

  const actor = positiveId(
    actorUserId,
    'INVALID_MEMBER_HISTORY_INPUT'
  )

  const cursor =
    beforeId === undefined
      ? null
      : positiveId(
          beforeId,
          'INVALID_MEMBER_HISTORY_CURSOR'
        )

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const accessResult = await db.query(
      `
        SELECT sm.id
        FROM salon_memberships sm
        JOIN users u
          ON u.id = sm.user_id
        JOIN salons s
          ON s.id = sm.salon_id
        WHERE sm.salon_id = $1
          AND sm.user_id = $2
          AND sm.active = true
          AND u.active = true
          AND s.active = true
          AND sm.role IN ('owner', 'admin')
        FOR SHARE OF sm, u, s
      `,
      [salon, actor]
    )

    if (!accessResult.rows[0]) {
      throw fail(
        'Your membership does not allow viewing this history.',
        'MEMBER_HISTORY_ACCESS_DENIED',
        403
      )
    }

    const result = await db.query(
      `
        SELECT
          h.id,
          h.salon_id,
          h.membership_id,
          h.target_user_id,
          h.actor_user_id,
          h.actor_role,
          h.action,
          h.old_role,
          h.new_role,
          h.old_active,
          h.new_active,
          h.created_at,

          actor_user.email AS actor_email,
          actor_user.display_name AS actor_display_name,

          target_user.email AS target_email,
          target_user.display_name AS target_display_name

        FROM salon_membership_changes h

        LEFT JOIN users actor_user
          ON actor_user.id = h.actor_user_id

        LEFT JOIN users target_user
          ON target_user.id = h.target_user_id

        WHERE h.salon_id = $1
          AND (
            $2::bigint IS NULL
            OR h.id < $2::bigint
          )

        ORDER BY h.id DESC
        LIMIT 51
      `,
      [salon, cursor]
    )

    const changes = result.rows.slice(0, 50)

    const nextBeforeId =
      result.rows.length > 50
        ? changes[changes.length - 1].id
        : null

    await db.query('COMMIT')

    return {
      changes,
      next_before_id: nextBeforeId,
    }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}