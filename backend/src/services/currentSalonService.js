import {
  findMembershipsByUserId,
} from '../repositories/salonMembershipRepository.js'

function createCurrentSalonError(
  message,
  code,
  statusCode
) {
  const error = new Error(message)

  error.code = code
  error.statusCode = statusCode

  return error
}

function isActiveMembership(membership) {
  return membership.membership_active === true
}

function isActiveSalon(membership) {
  return membership.salon_active === true
}

export async function resolveCurrentSalon(
  userId
) {
  const normalizedUserId =
    Number(userId)

  if (
    !Number.isSafeInteger(normalizedUserId) ||
    normalizedUserId <= 0
  ) {
    throw createCurrentSalonError(
      'A valid SalonAI user ID is required.',
      'INVALID_USER_ID',
      400
    )
  }

  const memberships =
    await findMembershipsByUserId(
      normalizedUserId
    )

  if (memberships.length === 0) {
    throw createCurrentSalonError(
      'The authenticated user does not belong to a salon.',
      'NO_SALON_MEMBERSHIP',
      403
    )
  }

  const activeMemberships =
    memberships.filter(
      isActiveMembership
    )

  if (activeMemberships.length === 0) {
    throw createCurrentSalonError(
      'The authenticated user does not have an active salon membership.',
      'NO_ACTIVE_SALON_MEMBERSHIP',
      403
    )
  }

  const usableMemberships =
    activeMemberships.filter(
      isActiveSalon
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

  const membership =
    usableMemberships[0]

  return {
    membership: {
      id: membership.membership_id,
      userId: membership.user_id,
      salonId: membership.salon_id,
      role: membership.role,
      active:
        membership.membership_active,
    },

    salon: {
      id: membership.salon_id,
      name: membership.salon_name,
      timezone:
        membership.salon_timezone,
      active:
        membership.salon_active,
    },
  }
}