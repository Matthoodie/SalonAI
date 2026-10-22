import {
  findMembershipsByUserId,
} from '../repositories/salonMembershipRepository.js'

function createCurrentSalonError(message, code, statusCode) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

function normalizeUserId(userId) {
  if (
    !['string', 'number'].includes(typeof userId) ||
    !Number.isSafeInteger(Number(userId)) ||
    Number(userId) <= 0
  ) {
    throw createCurrentSalonError(
      'A valid SalonAI user ID is required.',
      'INVALID_USER_ID',
      400
    )
  }

  return Number(userId)
}

function normalizeSelectedSalonId(value) {
  if (value === undefined) {
    return null
  }

  const validType =
    typeof value === 'string' ||
    typeof value === 'number'

  if (
    !validType ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw createCurrentSalonError(
      'Selected salon ID must be a positive integer.',
      'INVALID_SELECTED_SALON_ID',
      400
    )
  }

  return Number(value)
}

function isUsableMembership(membership) {
  return (
    membership.membership_active === true &&
    membership.salon_active === true
  )
}

function mapSalonContext(membership) {
  return {
    membership: {
      id: membership.membership_id,
      userId: membership.user_id,
      salonId: membership.salon_id,
      role: membership.role,
      employeeId:
        membership.employee_id == null
          ? null
          : Number(membership.employee_id),
      active: membership.membership_active,
    },

    salon: {
      id: membership.salon_id,
      name: membership.salon_name,
      timezone: membership.salon_timezone,
      active: membership.salon_active,
    },
  }
}

export async function getAvailableSalonContexts(userId) {
  const memberships = await findMembershipsByUserId(
    normalizeUserId(userId)
  )

  return memberships
    .filter(isUsableMembership)
    .map(mapSalonContext)
}

export async function resolveCurrentSalon(
  userId,
  selectedSalonId = undefined
) {
  const normalizedUserId = normalizeUserId(userId)

  const normalizedSelectedSalonId =
    normalizeSelectedSalonId(selectedSalonId)

  const memberships = await findMembershipsByUserId(
    normalizedUserId
  )

  if (normalizedSelectedSalonId !== null) {
    const selectedMembership = memberships.find(
      (membership) =>
        Number(membership.salon_id) ===
          normalizedSelectedSalonId &&
        isUsableMembership(membership)
    )

    if (!selectedMembership) {
      throw createCurrentSalonError(
        'The selected salon is not available to this user.',
        'SALON_ACCESS_DENIED',
        403
      )
    }

    return mapSalonContext(selectedMembership)
  }

  if (memberships.length === 0) {
    throw createCurrentSalonError(
      'The authenticated user does not belong to a salon.',
      'NO_SALON_MEMBERSHIP',
      403
    )
  }

  const activeMemberships = memberships.filter(
    (membership) => membership.membership_active === true
  )

  if (activeMemberships.length === 0) {
    throw createCurrentSalonError(
      'The authenticated user does not have an active salon membership.',
      'NO_ACTIVE_SALON_MEMBERSHIP',
      403
    )
  }

  const usableMemberships = activeMemberships.filter(
    (membership) => membership.salon_active === true
  )

  if (usableMemberships.length === 0) {
    throw createCurrentSalonError(
      'The salon for this membership is inactive.',
      'SALON_INACTIVE',
      403
    )
  }

  if (usableMemberships.length > 1) {
    throw createCurrentSalonError(
      'A current salon must be selected.',
      'CURRENT_SALON_SELECTION_REQUIRED',
      409
    )
  }

  return mapSalonContext(usableMemberships[0])
}