import {
  findMemberPermissionOverride,
} from '../repositories/salonMemberPermissionRepository.js'


import {
  PERMISSION_VALUES,
  SALON_PERMISSION_KEYS,
  SALON_PERMISSION_ALLOWED_VALUES,
  SALON_ROLE_PERMISSION_DEFAULTS,
} from '../permissions/salonPermissions.js'

import {
  findSalonPermissionOverride,
} from '../repositories/salonPermissionRepository.js'

function createPermissionError(
  message,
  code
) {
  const error =
    new Error(message)

  error.code = code
  error.statusCode = 500

  return error
}

export async function resolveSalonPermission({
  salonId,
  role,
  permissionKey,
  membershipId,
}) {
  const numericSalonId =
    Number(salonId)

  if (
    !Number.isSafeInteger(
      numericSalonId
    ) ||
    numericSalonId <= 0
  ) {
    throw createPermissionError(
      'A valid salon ID is required to resolve permissions.',
      'INVALID_PERMISSION_SALON_ID'
    )
  }

  const normalizedRole =
    String(role ?? '')
      .trim()
      .toLowerCase()

  const roleDefaults =
    SALON_ROLE_PERMISSION_DEFAULTS[
      normalizedRole
    ]

  if (!roleDefaults) {
    throw createPermissionError(
      'The salon role is not supported by the permission policy.',
      'INVALID_PERMISSION_ROLE'
    )
  }

  const allowedValues =
    SALON_PERMISSION_ALLOWED_VALUES[
      permissionKey
    ]

  if (!allowedValues) {
    throw createPermissionError(
      'The requested salon permission is not defined.',
      'UNKNOWN_SALON_PERMISSION'
    )
  }

  const defaultValue =
    roleDefaults[
      permissionKey
    ]

  if (!defaultValue) {
    throw createPermissionError(
      'The salon role has no default value for this permission.',
      'MISSING_PERMISSION_DEFAULT'
    )
  }

  if (normalizedRole === 'owner') {
    return defaultValue
  }

  const override =
    await findSalonPermissionOverride({
      salonId:
        numericSalonId,
      role:
        normalizedRole,
      permissionKey,
    })

  const overrideValue =
    override?.permission_value ?? defaultValue

  if (
    !allowedValues.includes(
      overrideValue
    )
  ) {
    throw createPermissionError(
      'The stored salon permission override is incompatible with this permission.',
      'INVALID_SALON_PERMISSION_OVERRIDE'
    )
  }

    if (
    normalizedRole === 'employee' &&
    overrideValue === PERMISSION_VALUES.ALL
  ) {
    throw createPermissionError(
      'Employee permissions cannot grant access to other employees.',
      'INVALID_SALON_PERMISSION_OVERRIDE'
    )
  }

  const individualKeys = [
    SALON_PERMISSION_KEYS.APPOINTMENT_CREATE,
    SALON_PERMISSION_KEYS.APPOINTMENT_RESCHEDULE,
    SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_STATUS,
    SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT,
  ]

  if (
    normalizedRole === 'employee' &&
    membershipId !== undefined &&
    individualKeys.includes(permissionKey)
  ) {
    if (
      !['string', 'number'].includes(typeof membershipId) ||
      !/^[1-9]\d*$/.test(String(membershipId)) ||
      !Number.isSafeInteger(Number(membershipId))
    ) {
      throw createPermissionError(
        'A valid membership ID is required.',
        'INVALID_PERMISSION_MEMBERSHIP_ID'
      )
    }

    const individual = await findMemberPermissionOverride({
      salonId: numericSalonId,
      membershipId: Number(membershipId),
      permissionKey,
    })

    if (individual) {
      if (
        ![
          PERMISSION_VALUES.DENY,
          PERMISSION_VALUES.SELF,
        ].includes(individual.permission_value)
      ) {
        throw createPermissionError(
          'The individual permission value is invalid.',
          'INVALID_MEMBER_PERMISSION_OVERRIDE'
        )
      }

      return individual.permission_value
    }
  }

  return overrideValue
}

export async function resolveAppointmentPermissionScope({
  salonId,
  membership,
  permissionKey,
}) {
  if (!membership) {
    const error = new Error(
      'Salon membership context is required to resolve appointment permissions.'
    )

    error.code =
      'SALON_MEMBERSHIP_CONTEXT_REQUIRED'

    error.statusCode = 500

    throw error
  }

  const permissionValue =
    await resolveSalonPermission({
      salonId,
      role: membership.role,
      permissionKey,
      membershipId: membership.id,
    })

  if (
    permissionValue ===
    PERMISSION_VALUES.DENY
  ) {
    const error = new Error(
      'Your salon permissions do not allow this action.'
    )

    error.code =
      'SALON_PERMISSION_DENIED'

    error.statusCode = 403

    throw error
  }

  if (
    permissionValue ===
    PERMISSION_VALUES.ALL
  ) {
    return {
      permissionValue,
      employeeId: null,
    }
  }

  if (
    permissionValue !==
    PERMISSION_VALUES.SELF
  ) {
    const error = new Error(
      'The resolved permission cannot be used for an appointment action.'
    )

    error.code =
      'INVALID_APPOINTMENT_PERMISSION_VALUE'

    error.statusCode = 500

    throw error
  }

  const employeeId =
    Number(
      membership.employeeId
    )

  if (
    !Number.isSafeInteger(
      employeeId
    ) ||
    employeeId <= 0
  ) {
    const error = new Error(
      'This permission requires a valid employee identity.'
    )

    error.code =
      'EMPLOYEE_MEMBERSHIP_IDENTITY_REQUIRED'

    error.statusCode = 500

    throw error
  }

  return {
    permissionValue,
    employeeId,
  }
}

export async function resolveAppointmentPermissions({
  salonId,
  role,
  membershipId,
}) {
  const keys = [
    SALON_PERMISSION_KEYS.APPOINTMENT_CREATE,
    SALON_PERMISSION_KEYS.APPOINTMENT_RESCHEDULE,
    SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_STATUS,
    SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT,
  ]

  const entries = await Promise.all(
    keys.map(async (permissionKey) => {
      const value = await resolveSalonPermission({
        salonId,
        role,
        permissionKey,
        membershipId,
      })

      return [permissionKey, value]
    })
  )

  return Object.fromEntries(entries)
}