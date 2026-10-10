import {
  Router,
} from 'express'

import {
  getCurrentAuth,
} from '../controllers/authController.js'

import {
  requireAuthenticatedUser,
} from '../middleware/authenticatedUserMiddleware.js'

const router = Router()

router.get(
  '/me',
  requireAuthenticatedUser,
  getCurrentAuth
)

export default router