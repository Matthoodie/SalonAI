import {
  Router,
} from 'express'

import {
  getCurrentAuth,
} from '../controllers/authController.js'

const router = Router()

router.get(
  '/me',
  getCurrentAuth
)

export default router