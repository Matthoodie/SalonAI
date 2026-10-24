import { Router } from 'express'

import {
  listSalonMembers,
  listSalonMemberHistory,
  changeSalonMemberRole,
  changeSalonMemberActive,
} from '../controllers/salonMemberController.js'

import {
  getPermissionSettings,
  changeMemberPermission,
  changePermissionDelegation,
} from '../controllers/salonPermissionManagementController.js'

import {
  requireSalonRole,
} from '../middleware/roleMiddleware.js'

const router = Router()

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

router.get(
  '/permission-settings',
  requireSalonRole('owner', 'admin'),
  getPermissionSettings
)

router.put(
  '/permission-delegations',
  requireSalonRole('owner'),
  changePermissionDelegation
)

router.patch(
  '/:id/permissions',
  requireSalonRole('owner', 'admin'),
  changeMemberPermission
)

router.get(
  '/history',
  requireSalonRole('owner', 'admin'),
  listSalonMemberHistory
)

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