import {
  createApp,
} from '../../src/createApp.js'

export function createFixedTenantTestApp(
  salonId,
  {
    role = 'owner',
    employeeId = null,
    userId = salonId,
  } = {}
) {
  const numericSalonId = Number(salonId)
  const numericUserId = Number(userId)

  if (
    !Number.isSafeInteger(numericSalonId) ||
    numericSalonId <= 0
  ) {
    throw new Error(
      'Fixed test salon ID must be a positive integer.'
    )
  }

  if (
    !Number.isSafeInteger(numericUserId) ||
    numericUserId <= 0
  ) {
    throw new Error(
      'Fixed test user ID must be a positive integer.'
    )
  }

  function attachFixedTenantContext(req, res, next) {
    req.currentUser = {
      id: numericUserId,
      active: true,
    }

    req.currentSalon = {
      id: numericSalonId,
    }

    req.currentMembership = {
      userId: numericUserId,
      salonId: numericSalonId,
      role,
      employeeId,
      active: true,
    }

    return next()
  }

  return createApp({
    privateRouteMiddleware: [
      attachFixedTenantContext,
    ],
  })
}