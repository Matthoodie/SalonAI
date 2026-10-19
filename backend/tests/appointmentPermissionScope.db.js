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
  resolveAppointmentPermissionScope,
} from '../src/services/salonPermissionService.js'

let salonId = null
let employeeId = null

const token =
  `${Date.now()}-${process.pid}`

before(async () => {
  const salonResult =
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
        `Appointment Permission Scope ${token}`,
      ]
    )

  salonId =
    Number(
      salonResult.rows[0].id
    )

  const employeeResult =
    await pool.query(
      `
        INSERT INTO employees (
          salon_id,
          name
        )
        VALUES (
          $1,
          'Permission Scope Employee'
        )
        RETURNING id
      `,
      [salonId]
    )

  employeeId =
    Number(
      employeeResult.rows[0].id
    )
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

test(
  'employee self permission resolves own employee scope',
  async () => {
    const result =
      await resolveAppointmentPermissionScope({
        salonId,

        membership: {
          role: 'employee',
          employeeId,
        },

        permissionKey:
          SALON_PERMISSION_KEYS
            .APPOINTMENT_CREATE,
      })

    assert.equal(
      result.permissionValue,
      'self'
    )

    assert.equal(
      result.employeeId,
      employeeId
    )
  }
)

test(
  'admin all permission resolves unrestricted employee scope',
  async () => {
    const result =
      await resolveAppointmentPermissionScope({
        salonId,

        membership: {
          role: 'admin',
          employeeId: null,
        },

        permissionKey:
          SALON_PERMISSION_KEYS
            .APPOINTMENT_CHANGE_STATUS,
      })

    assert.equal(
      result.permissionValue,
      'all'
    )

    assert.equal(
      result.employeeId,
      null
    )
  }
)

test(
  'owner all permission resolves unrestricted employee scope',
  async () => {
    const result =
      await resolveAppointmentPermissionScope({
        salonId,

        membership: {
          role: 'owner',
          employeeId: null,
        },

        permissionKey:
          SALON_PERMISSION_KEYS
            .APPOINTMENT_CHANGE_CLIENT,
      })

    assert.equal(
      result.permissionValue,
      'all'
    )

    assert.equal(
      result.employeeId,
      null
    )
  }
)

test(
  'salon deny override blocks employee appointment action',
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
          'deny'
        )
      `,
      [
        salonId,
        SALON_PERMISSION_KEYS
          .APPOINTMENT_CHANGE_STATUS,
      ]
    )

    await assert.rejects(
      () =>
        resolveAppointmentPermissionScope({
          salonId,

          membership: {
            role: 'employee',
            employeeId,
          },

          permissionKey:
            SALON_PERMISSION_KEYS
              .APPOINTMENT_CHANGE_STATUS,
        }),
      (error) => {
        assert.equal(
          error.statusCode,
          403
        )

        assert.equal(
          error.code,
          'SALON_PERMISSION_DENIED'
        )

        return true
      }
    )
  }
)

test(
  'self permission requires employee identity binding',
  async () => {
    await assert.rejects(
      () =>
        resolveAppointmentPermissionScope({
          salonId,

          membership: {
            role: 'employee',
            employeeId: null,
          },

          permissionKey:
            SALON_PERMISSION_KEYS
              .APPOINTMENT_CREATE,
        }),
      (error) => {
        assert.equal(
          error.code,
          'EMPLOYEE_MEMBERSHIP_IDENTITY_REQUIRED'
        )

        return true
      }
    )
  }
)