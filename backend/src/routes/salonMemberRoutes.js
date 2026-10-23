import { Router } from 'express'

import {
  listSalonMembers,
} from '../controllers/salonMemberController.js'

import {
  requireSalonRole,
} from '../middleware/roleMiddleware.js'

const router = Router()

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

router.get(
  '/',
  requireSalonRole('owner', 'admin'),
  listSalonMembers
)

export default router