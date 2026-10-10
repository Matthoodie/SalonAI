import {
  getAuth,
} from '@clerk/express'

import {
  resolveAuthenticatedUser,
} from '../services/authenticatedIdentityService.js'

export async function requireAuthenticatedUser(
  req,
  res,
  next
) {
  try {
    const auth = getAuth(req)

    if (
      !auth.isAuthenticated ||
      !auth.userId
    ) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message:
            'Authentication is required.',
        },
      })
    }

    const currentUser =
      await resolveAuthenticatedUser(
        auth.userId
      )

    req.currentUser =
      currentUser

    return next()
  } catch (error) {
    return next(error)
  }
}