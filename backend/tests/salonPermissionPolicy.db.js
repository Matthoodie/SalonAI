import test, {
  before,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  SALON_PERMISSION_KEYS,
} from '../src/permissions/salonPermissions.js'

import {
  resolveSalonPermission,
} from '../src/services/salonPermissionService.js'

let salonId = null

const token =
  `${Date.now()}-${process.pid}`

before(async () => {
  const result =
    await pool.query(
      `
        INSERT INTO salons (
          name,
          timezone
        )
        VALUES (
          $1,
          'Europe/Zagreb'
        )
        RETURNING id
      `,
      [
        `Permission Policy Test ${token}`,
      ]
    )

  salonId =
    Number(result.rows[0].id)
})

after(async () => {
  if (salonId) {
    await pool.query(
      `
        DELETE FROM salons
        WHERE id = $1
      `,
      [salonId]
    )
  }

  await pool.end()
})

test('employee defaults allow own creation but deny appointment changes', async () => {
  const expectedPermissions = [
    [SALON_PERMISSION_KEYS.APPOINTMENT_CREATE, 'self'],
    [SALON_PERMISSION_KEYS.CALENDAR_VIEW, 'self'],
    [SALON_PERMISSION_KEYS.APPOINTMENT_RESCHEDULE, 'deny'],
    [SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_STATUS, 'deny'],
    [SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT, 'deny'],
  ]

  for (const [permissionKey, expected] of expectedPermissions) {
    const value = await resolveSalonPermission({
      salonId,
      role: 'employee',
      permissionKey,
    })

    assert.equal(value, expected, permissionKey)
  }
})

test(
  'employee schedule changes require approval by default',
  async () => {
    const value =
      await resolveSalonPermission({
        salonId,
        role: 'employee',
        permissionKey:
          SALON_PERMISSION_KEYS
            .SCHEDULE_WORKING_HOURS,
      })

    assert.equal(
      value,
      'approval'
    )
  }
)

test(
  'admin receives all appointment access by default',
  async () => {
    const value =
      await resolveSalonPermission({
        salonId,
        role: 'admin',
        permissionKey:
          SALON_PERMISSION_KEYS
            .APPOINTMENT_CHANGE_STATUS,
      })

    assert.equal(
      value,
      'all'
    )
  }
)

test(
  'owner uses hard policy without database override',
  async () => {
    const value =
      await resolveSalonPermission({
        salonId,
        role: 'owner',
        permissionKey:
          SALON_PERMISSION_KEYS
            .SCHEDULE_TIME_OFF,
      })

    assert.equal(
      value,
      'direct'
    )
  }
)

test('salon can grant self access instead of default deny', async () => {
  const permissionKey =
    SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT

  await pool.query(
    `
      INSERT INTO salon_permission_overrides (
        salon_id, role, permission_key, permission_value
      )
      VALUES ($1, 'employee', $2, 'self')
    `,
    [salonId, permissionKey]
  )

  try {
    const value = await resolveSalonPermission({
      salonId,
      role: 'employee',
      permissionKey,
    })

    assert.equal(value, 'self')
  } finally {
    await pool.query(
      `
        DELETE FROM salon_permission_overrides
        WHERE salon_id = $1
          AND role = 'employee'
          AND permission_key = $2
      `,
      [salonId, permissionKey]
    )
  }
})

test(
  'resolver rejects unknown permission key',
  async () => {
    await assert.rejects(
      () =>
        resolveSalonPermission({
          salonId,
          role: 'employee',
          permissionKey:
            'something.fake',
        }),
      (error) => {
        assert.equal(
          error.code,
          'UNKNOWN_SALON_PERMISSION'
        )

        return true
      }
    )
  }
)

test(
  'resolver rejects invalid role',
  async () => {
    await assert.rejects(
      () =>
        resolveSalonPermission({
          salonId,
          role: 'superadmin',
          permissionKey:
            SALON_PERMISSION_KEYS
              .APPOINTMENT_CREATE,
        }),
      (error) => {
        assert.equal(
          error.code,
          'INVALID_PERMISSION_ROLE'
        )

        return true
      }
    )
  }
)

test(
  'resolver rejects incompatible stored override',
  async () => {
    await pool.query(
      `
        INSERT INTO salon_permission_overrides (
          salon_id,
          role,
          permission_key,
          permission_value
        )
        VALUES (
          $1,
          'employee',
          $2,
          'approval'
        )
      `,
      [
        salonId,
        SALON_PERMISSION_KEYS
          .APPOINTMENT_CREATE,
      ]
    )

    await assert.rejects(
      () =>
        resolveSalonPermission({
          salonId,
          role: 'employee',
          permissionKey:
            SALON_PERMISSION_KEYS
              .APPOINTMENT_CREATE,
        }),
      (error) => {
        assert.equal(
          error.code,
          'INVALID_SALON_PERMISSION_OVERRIDE'
        )

        return true
      }
    )
  }
)

test('employee all overrides are rejected for every appointment action and calendar', async () => {
  const permissionKeys = [
    SALON_PERMISSION_KEYS.APPOINTMENT_CREATE,
    SALON_PERMISSION_KEYS.APPOINTMENT_RESCHEDULE,
    SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_STATUS,
    SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT,
    SALON_PERMISSION_KEYS.CALENDAR_VIEW,
  ]

  for (const permissionKey of permissionKeys) {
    await pool.query(
      `
        INSERT INTO salon_permission_overrides (
          salon_id, role, permission_key, permission_value
        )
        VALUES ($1, 'employee', $2, 'all')
        ON CONFLICT (salon_id, role, permission_key)
        DO UPDATE SET permission_value = EXCLUDED.permission_value
      `,
      [salonId, permissionKey]
    )

    try {
      await assert.rejects(
        () => resolveSalonPermission({
          salonId,
          role: 'employee',
          permissionKey,
        }),
        {
          code: 'INVALID_SALON_PERMISSION_OVERRIDE',
          statusCode: 500,
        },
        permissionKey
      )
    } finally {
      await pool.query(
        `
          DELETE FROM salon_permission_overrides
          WHERE salon_id = $1
            AND role = 'employee'
            AND permission_key = $2
        `,
        [salonId, permissionKey]
      )
    }
  }
})