import {
  Router,
} from 'express'

import {
  getCurrentAuth,
} from '../controllers/authController.js'

import {
  requireAuthenticatedUser,
} from '../middleware/authenticatedUserMiddleware.js'

import {
  requireCurrentSalon,
} from '../middleware/currentSalonMiddleware.js'

const router = Router()

router.get(
  '/me',
  requireAuthenticatedUser,
  requireCurrentSalon,
  getCurrentAuth
)

export default router