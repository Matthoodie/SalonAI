import { Router } from 'express'

import {
  createServiceController,
  getServices,
  updateServiceActiveController,
  updateServiceController,
} from '../controllers/serviceController.js'

const router = Router()

router.get('/', getServices)
router.post('/', createServiceController)
router.patch('/:id', updateServiceController)
router.patch('/:id/active', updateServiceActiveController)

export default router