import pool from '../database/pool.js'

function fail(message, code, statusCode = 403) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

function positiveId(value) {
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw fail(
      'A valid membership identifier is required.',
      'INVALID_MEMBER_INPUT',
      400
    )
  }

  return Number(value)
}

function mapMembership(row) {
  return {
    id: row.id,
    salon_id: row.salon_id,
    user_id: row.user_id,
    role: row.role,
    employee_id: row.employee_id,
    active: row.active,
  }
}

async function changeMembership({
  salonId,
  actorUserId,
  membershipId,
  action,
  value,
}) {
  const salon = positiveId(salonId)
  const actorId = positiveId(actorUserId)
  const targetId = positiveId(membershipId)

  if (
    action === 'role' &&
    !['employee', 'admin'].includes(value)
  ) {
    throw fail(
      'The requested membership role is invalid.',
      'INVALID_MEMBER_ROLE',
      400
    )
  }

  if (action === 'active' && typeof value !== 'boolean') {
    throw fail(
      'Membership activity must be a boolean.',
      'INVALID_MEMBER_ACTIVE',
      400
    )
  }

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    // Serialize membership changes within the same salon.
    const salonResult = await db.query(
      `
        SELECT id, active
        FROM salons
        WHERE id = $1
        FOR UPDATE
      `,
      [salon]
    )

    if (salonResult.rows[0]?.active !== true) {
      throw fail(
        'The salon is unavailable.',
        'MEMBER_SALON_UNAVAILABLE'
      )
    }

    // Lock actor and target memberships in a consistent order.
    const membershipsResult = await db.query(
      `
        SELECT id, salon_id, user_id, role, employee_id, active
        FROM salon_memberships
        WHERE salon_id = $1
          AND (user_id = $2 OR id = $3)
        ORDER BY id
        FOR UPDATE
      `,
      [salon, actorId, targetId]
    )

    const actor = membershipsResult.rows.find(
      (row) => Number(row.user_id) === actorId
    )

    const target = membershipsResult.rows.find(
      (row) => Number(row.id) === targetId
    )

    const actorUserResult = await db.query(
      `
        SELECT id, active
        FROM users
        WHERE id = $1
        FOR SHARE
      `,
      [actorId]
    )

    if (
      actorUserResult.rows[0]?.active !== true ||
      actor?.active !== true ||
      !['owner', 'admin'].includes(actor.role)
    ) {
      throw fail(
        'Your current membership cannot manage salon members.',
        'MEMBER_ACTOR_FORBIDDEN'
      )
    }

    if (!target) {
      throw fail(
        'The membership was not found in this salon.',
        'MEMBER_NOT_FOUND',
        404
      )
    }

    if (Number(target.user_id) === actorId) {
      throw fail(
        'You cannot change your own membership here.',
        'MEMBER_SELF_CHANGE_FORBIDDEN'
      )
    }

    if (target.role === 'owner') {
      throw fail(
        'Owner membership is protected.',
        'MEMBER_OWNER_PROTECTED'
      )
    }

    if (
      actor.role !== 'owner' &&
      (action === 'role' || target.role === 'admin')
    ) {
      throw fail(
        'Only the owner can manage administrator privileges.',
        'MEMBER_OWNER_REQUIRED'
      )
    }

    if (
      action === 'role' &&
      value === 'employee' &&
      target.employee_id === null
    ) {
      throw fail(
        'An employee profile is required before changing this role.',
        'MEMBER_EMPLOYEE_PROFILE_REQUIRED',
        409
      )
    }

    const nextRole = action === 'role' ? value : target.role
    const nextActive = action === 'active' ? value : target.active

    if (
      nextRole === target.role &&
      nextActive === target.active
    ) {
      await db.query('COMMIT')

      return {
        membership: mapMembership(target),
        changed: false,
      }
    }

    const updatedResult = await db.query(
      `
        UPDATE salon_memberships
        SET role = $3,
            active = $4,
            updated_at = clock_timestamp()
        WHERE id = $1 AND salon_id = $2
        RETURNING
          id, salon_id, user_id, role, employee_id, active
      `,
      [targetId, salon, nextRole, nextActive]
    )

    await db.query(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        salon,
        targetId,
        target.user_id,
        actorId,
        actor.role,
        action,
        target.role,
        nextRole,
        target.active,
        nextActive,
      ]
    )

    await db.query('COMMIT')

    return {
      membership: mapMembership(updatedResult.rows[0]),
      changed: true,
    }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}

export function updateSalonMemberRole({
  salonId,
  actorUserId,
  membershipId,
  role,
}) {
  return changeMembership({
    salonId,
    actorUserId,
    membershipId,
    action: 'role',
    value: role,
  })
}

export function updateSalonMemberActive({
  salonId,
  actorUserId,
  membershipId,
  active,
}) {
  return changeMembership({
    salonId,
    actorUserId,
    membershipId,
    action: 'active',
    value: active,
  })
}