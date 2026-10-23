import { Router } from 'express'

import {
  listSalonMembers,
  changeSalonMemberRole,
  changeSalonMemberActive,
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

router.patch(
  '/:id/role',
  requireSalonRole('owner'),
  changeSalonMemberRole
)

router.patch(
  '/:id/active',
  requireSalonRole('owner', 'admin'),
  changeSalonMemberActive
)

export default router