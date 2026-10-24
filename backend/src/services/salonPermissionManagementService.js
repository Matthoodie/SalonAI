import {
  SALON_ROLE_PERMISSION_DEFAULTS,
} from '../permissions/salonPermissions.js'


import pool from '../database/pool.js'

const MANAGED_KEYS = new Set([
  'appointment.create',
  'appointment.reschedule',
  'appointment.change_status',
  'appointment.change_client',
])

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
      'A valid identifier is required.',
      'INVALID_PERMISSION_MANAGEMENT_INPUT',
      400
    )
  }

  return Number(value)
}

function validateKey(permissionKey) {
  if (!MANAGED_KEYS.has(permissionKey)) {
    throw fail(
      'This permission cannot be managed here.',
      'PERMISSION_KEY_NOT_MANAGEABLE',
      400
    )
  }
}

async function lockSalonAndActor(db, salonId, actorUserId) {
  // Shared serialization point for membership and permission changes.
  const salonResult = await db.query(
    `
      SELECT id, active
      FROM salons
      WHERE id = $1
      FOR UPDATE
    `,
    [salonId]
  )

  if (salonResult.rows[0]?.active !== true) {
    throw fail(
      'The salon is unavailable.',
      'PERMISSION_SALON_UNAVAILABLE'
    )
  }

  const actorResult = await db.query(
    `
      SELECT sm.id, sm.role
      FROM salon_memberships sm
      JOIN users u
        ON u.id = sm.user_id
      WHERE sm.salon_id = $1
        AND sm.user_id = $2
        AND sm.active = true
        AND u.active = true
        AND sm.role IN ('owner', 'admin')
      FOR SHARE OF sm, u
    `,
    [salonId, actorUserId]
  )

  const actor = actorResult.rows[0]

  if (!actor) {
    throw fail(
      'Your current membership cannot manage permissions.',
      'PERMISSION_MANAGEMENT_FORBIDDEN'
    )
  }

  return actor
}

async function inTransaction(operation) {
  const db = await pool.connect()

  try {
    await db.query('BEGIN')
    const result = await operation(db)
    await db.query('COMMIT')
    return result
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}

export async function setMemberPermission({
  salonId,
  actorUserId,
  membershipId,
  permissionKey,
  value,
}) {
  const salon = positiveId(salonId)
  const actorId = positiveId(actorUserId)
  const targetId = positiveId(membershipId)

  validateKey(permissionKey)

  // null explicitly means "inherit". Missing value is invalid.
  if (value !== null && value !== 'deny' && value !== 'self') {
    throw fail(
      'Permission must be deny, self or null.',
      'INVALID_MEMBER_PERMISSION_VALUE',
      400
    )
  }

  return inTransaction(async (db) => {
    const actor = await lockSalonAndActor(db, salon, actorId)

    if (actor.role === 'admin') {
      const delegated = await db.query(
        `
          SELECT permission_key
          FROM salon_permission_admin_delegations
          WHERE salon_id = $1 AND permission_key = $2
        `,
        [salon, permissionKey]
      )

      if (!delegated.rows[0]) {
        throw fail(
          'The owner has not delegated management of this permission.',
          'PERMISSION_ADMIN_DELEGATION_REQUIRED'
        )
      }
    }

    const targetResult = await db.query(
      `
        SELECT id, user_id, role, active
        FROM salon_memberships
        WHERE id = $1 AND salon_id = $2
        FOR UPDATE
      `,
      [targetId, salon]
    )

    const target = targetResult.rows[0]

    if (!target) {
      throw fail(
        'The membership was not found in this salon.',
        'PERMISSION_TARGET_NOT_FOUND',
        404
      )
    }

    if (Number(target.user_id) === actorId) {
      throw fail(
        'You cannot change your own permissions here.',
        'PERMISSION_SELF_CHANGE_FORBIDDEN'
      )
    }

    if (target.role !== 'employee' || target.active !== true) {
      throw fail(
        'Only active employee memberships can be configured here.',
        'PERMISSION_TARGET_NOT_EMPLOYEE',
        409
      )
    }

    const previousResult = await db.query(
      `
        SELECT permission_value
        FROM salon_member_permission_overrides
        WHERE salon_id = $1
          AND membership_id = $2
          AND permission_key = $3
        FOR UPDATE
      `,
      [salon, targetId, permissionKey]
    )

    const previousValue =
      previousResult.rows[0]?.permission_value ?? null

    if (previousValue === value) {
      return {
        membership_id: target.id,
        permission_key: permissionKey,
        value,
        changed: false,
      }
    }

    if (value === null) {
      await db.query(
        `
          DELETE FROM salon_member_permission_overrides
          WHERE salon_id = $1
            AND membership_id = $2
            AND permission_key = $3
        `,
        [salon, targetId, permissionKey]
      )
    } else {
      await db.query(
        `
          INSERT INTO salon_member_permission_overrides (
            salon_id,
            membership_id,
            permission_key,
            permission_value
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (membership_id, permission_key)
          DO UPDATE SET
            permission_value = EXCLUDED.permission_value,
            updated_at = clock_timestamp()
        `,
        [salon, targetId, permissionKey, value]
      )
    }

    await db.query(
      `
        INSERT INTO salon_permission_changes (
          salon_id,
          actor_user_id,
          actor_role,
          membership_id,
          target_user_id,
          action,
          permission_key,
          previous_value,
          next_value
        )
        VALUES ($1, $2, $3, $4, $5, 'member_override', $6, $7, $8)
      `,
      [
        salon,
        actorId,
        actor.role,
        targetId,
        target.user_id,
        permissionKey,
        previousValue,
        value,
      ]
    )

    return {
      membership_id: target.id,
      permission_key: permissionKey,
      value,
      changed: true,
    }
  })
}

export async function setPermissionAdminDelegation({
  salonId,
  actorUserId,
  permissionKey,
  enabled,
}) {
  const salon = positiveId(salonId)
  const actorId = positiveId(actorUserId)

  validateKey(permissionKey)

  if (typeof enabled !== 'boolean') {
    throw fail(
      'Delegation must be a boolean.',
      'INVALID_PERMISSION_DELEGATION_VALUE',
      400
    )
  }

  return inTransaction(async (db) => {
    const actor = await lockSalonAndActor(db, salon, actorId)

    if (actor.role !== 'owner') {
      throw fail(
        'Only the owner can change permission delegation.',
        'PERMISSION_DELEGATION_OWNER_REQUIRED'
      )
    }

    const previousResult = await db.query(
      `
        SELECT permission_key
        FROM salon_permission_admin_delegations
        WHERE salon_id = $1 AND permission_key = $2
      `,
      [salon, permissionKey]
    )

    const previouslyEnabled = previousResult.rows.length > 0

    if (previouslyEnabled === enabled) {
      return {
        permission_key: permissionKey,
        enabled,
        changed: false,
      }
    }

    if (enabled) {
      await db.query(
        `
          INSERT INTO salon_permission_admin_delegations (
            salon_id, permission_key
          )
          VALUES ($1, $2)
        `,
        [salon, permissionKey]
      )
    } else {
      await db.query(
        `
          DELETE FROM salon_permission_admin_delegations
          WHERE salon_id = $1 AND permission_key = $2
        `,
        [salon, permissionKey]
      )
    }

    await db.query(
      `
        INSERT INTO salon_permission_changes (
          salon_id,
          actor_user_id,
          actor_role,
          action,
          permission_key,
          previous_value,
          next_value
        )
        VALUES ($1, $2, 'owner', 'admin_delegation', $3, $4, $5)
      `,
      [
        salon,
        actorId,
        permissionKey,
        previouslyEnabled ? 'enabled' : 'disabled',
        enabled ? 'enabled' : 'disabled',
      ]
    )

    return {
      permission_key: permissionKey,
      enabled,
      changed: true,
    }
  })
}


export async function getPermissionManagementSettings({
  salonId,
  actorUserId,
}) {
  const salon = positiveId(salonId)
  const actorId = positiveId(actorUserId)

  return inTransaction(async (db) => {
    const actor = await lockSalonAndActor(db, salon, actorId)

    const roleResult = await db.query(
      `
        SELECT permission_key, permission_value
        FROM salon_permission_overrides
        WHERE salon_id = $1
          AND role = 'employee'
          AND permission_key = ANY($2::varchar[])
      `,
      [salon, [...MANAGED_KEYS]]
    )

    const roleOverrides = new Map(
      roleResult.rows.map((row) => [
        row.permission_key,
        row.permission_value,
      ])
    )

    const delegationResult = await db.query(
      `
        SELECT permission_key
        FROM salon_permission_admin_delegations
        WHERE salon_id = $1
      `,
      [salon]
    )

    const delegated = new Set(
      delegationResult.rows.map((row) => row.permission_key)
    )

    const permissions = [...MANAGED_KEYS].map((key) => {
      const inheritedValue =
        roleOverrides.get(key) ??
        SALON_ROLE_PERMISSION_DEFAULTS.employee[key]

      if (!['deny', 'self'].includes(inheritedValue)) {
        throw fail(
          'The employee role permission is invalid.',
          'INVALID_SALON_PERMISSION_OVERRIDE',
          500
        )
      }

      return {
        key,
        inherited_value: inheritedValue,
        admin_delegated: delegated.has(key),
        can_edit:
          actor.role === 'owner' ||
          delegated.has(key),
      }
    })

    const membersResult = await db.query(
      `
        SELECT
          sm.id,
          sm.user_id,
          sm.employee_id,
          u.email,
          u.display_name,
          u.active AS user_active,
          e.name AS employee_name,
          e.active AS employee_active

        FROM salon_memberships sm

        JOIN users u
          ON u.id = sm.user_id

        JOIN employees e
          ON e.id = sm.employee_id
          AND e.salon_id = sm.salon_id

        WHERE sm.salon_id = $1
          AND sm.role = 'employee'
          AND sm.active = true

        ORDER BY lower(u.email), sm.id
      `,
      [salon]
    )

    const overridesResult = await db.query(
      `
        SELECT
          p.membership_id,
          p.permission_key,
          p.permission_value

        FROM salon_member_permission_overrides p

        JOIN salon_memberships sm
          ON sm.id = p.membership_id
          AND sm.salon_id = p.salon_id

        WHERE p.salon_id = $1
          AND sm.role = 'employee'
          AND sm.active = true
      `,
      [salon]
    )

    const overridesByMember = new Map()

    for (const row of overridesResult.rows) {
      const id = String(row.membership_id)

      if (!overridesByMember.has(id)) {
        overridesByMember.set(id, {})
      }

      overridesByMember.get(id)[row.permission_key] =
        row.permission_value
    }

    const members = membersResult.rows.map((member) => {
      const stored =
        overridesByMember.get(String(member.id)) ?? {}

      return {
        ...member,

        overrides: Object.fromEntries(
          permissions.map(({ key }) => [
            key,
            stored[key] ?? null,
          ])
        ),

        effective_permissions: Object.fromEntries(
          permissions.map(({ key, inherited_value }) => [
            key,
            stored[key] ?? inherited_value,
          ])
        ),
      }
    })

    return {
      salon_id: salon,
      can_manage_delegation: actor.role === 'owner',
      permissions,
      members,
    }
  })
}