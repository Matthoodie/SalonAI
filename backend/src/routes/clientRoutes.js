import { Router } from 'express'

import {
  getClients,
  createClient,
  updateClient,
  updateClientActive,
} from '../controllers/clientController.js'

import {
  requireSalonRole,
} from '../middleware/roleMiddleware.js'

const router = Router()

router.get('/', getClients)

router.post(
  '/',
  requireSalonRole('owner', 'admin'),
  createClient
)

router.patch(
  '/:id',
  requireSalonRole('owner', 'admin'),
  updateClient
)

router.patch(
  '/:id/active',
  requireSalonRole('owner', 'admin'),
  updateClientActive
)

export default router