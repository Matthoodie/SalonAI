import {
  createApp,
} from '../../src/createApp.js'

export function createFixedTenantTestApp(
  salonId,
  {
    role = 'owner',
    employeeId = null,
  } = {}
) {
  const numericSalonId =
    Number(salonId)

  if (
    !Number.isSafeInteger(numericSalonId) ||
    numericSalonId <= 0
  ) {
    throw new Error(
      'Fixed test salon ID must be a positive integer.'
    )
  }

  function attachFixedTenantContext(
    req,
    res,
    next
  ) {
    req.currentSalon = {
      id: numericSalonId,
    }

req.currentMembership = {
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
