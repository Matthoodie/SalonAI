import {
  clerkMiddleware,
} from '@clerk/express'

import {
  createApp,
} from './createApp.js'

import {
  requireAuthenticatedUser,
} from './middleware/authenticatedUserMiddleware.js'

import {
  requireCurrentSalon,
} from './middleware/currentSalonMiddleware.js'

const clerkAuthMiddleware =
  clerkMiddleware()

const app = createApp({
  authRouteMiddleware: [
    clerkAuthMiddleware,
  ],

  privateRouteMiddleware: [
    clerkAuthMiddleware,
    requireAuthenticatedUser,
    requireCurrentSalon,
  ],
})

export default app