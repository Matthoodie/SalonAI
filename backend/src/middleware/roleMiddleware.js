const VALID_SALON_ROLES =
  new Set([
    'owner',
    'admin',
    'employee',
  ])

function createRoleError(
  message,
  code,
  statusCode
) {
  const error =
    new Error(message)

  error.code = code
  error.statusCode = statusCode

  return error
}

export function requireSalonRole(
  ...allowedRoles
) {
  const normalizedAllowedRoles =
    allowedRoles.map((role) =>
      String(role)
        .trim()
        .toLowerCase()
    )

  for (
    const role
    of normalizedAllowedRoles
  ) {
    if (!VALID_SALON_ROLES.has(role)) {
      throw new Error(
        `Invalid SalonAI role configured: ${role}`
      )
    }
  }

  return function requireSalonRoleMiddleware(
    req,
    res,
    next
  ) {
    try {
      if (!req.currentMembership) {
        throw createRoleError(
          'Salon membership context is required before checking permissions.',
          'SALON_MEMBERSHIP_CONTEXT_REQUIRED',
          500
        )
      }

      const currentRole =
        String(
          req.currentMembership.role ?? ''
        )
          .trim()
          .toLowerCase()

      if (!VALID_SALON_ROLES.has(currentRole)) {
        throw createRoleError(
          'The current salon membership has an invalid role.',
          'INVALID_SALON_ROLE',
          403
        )
      }

      if (
        !normalizedAllowedRoles.includes(
          currentRole
        )
      ) {
        throw createRoleError(
          'Your salon role does not allow this action.',
          'INSUFFICIENT_SALON_ROLE',
          403
        )
      }

      return next()
    } catch (error) {
      return next(error)
    }
  }
}
