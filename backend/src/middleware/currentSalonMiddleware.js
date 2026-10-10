import {
  resolveCurrentSalon,
} from '../services/currentSalonService.js'

export async function requireCurrentSalon(
  req,
  res,
  next
) {
  try {
    if (!req.currentUser?.id) {
      const error = new Error(
        'Authenticated user context is required before resolving the current salon.'
      )

      error.code =
        'AUTHENTICATED_USER_CONTEXT_REQUIRED'

      error.statusCode = 500

      throw error
    }

    const {
      membership,
      salon,
    } = await resolveCurrentSalon(
      req.currentUser.id
    )

    req.currentMembership =
      membership

    req.currentSalon =
      salon

    return next()
  } catch (error) {
    return next(error)
  }
}