import {
  getAuth,
} from '@clerk/express'

export function getCurrentAuth(
  req,
  res
) {
  const auth = getAuth(req)

  if (!auth.isAuthenticated) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message:
          'Authentication is required.',
      },
    })
  }

  return res.status(200).json({
    data: {
      authenticated: true,
      clerkUserId: auth.userId,
    },
  })
}