import { Router } from 'express'

import {
  createServiceController,
  getServices,
  updateServiceActiveController,
  updateServiceController,
} from '../controllers/serviceController.js'

import {
  requireSalonRole,
} from '../middleware/roleMiddleware.js'

const router = Router()

router.get('/', getServices)
router.post(
  '/',
  requireSalonRole('owner', 'admin'),
  createServiceController
)

router.patch(
  '/:id',
  requireSalonRole('owner', 'admin'),
  updateServiceController
)

router.patch(
  '/:id/active',
  requireSalonRole('owner', 'admin'),
  updateServiceActiveController
)

export default router