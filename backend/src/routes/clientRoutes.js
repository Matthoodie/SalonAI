import { Router } from 'express'

import {
  getClients,
  createClient,
  updateClient,
  updateClientActive,
  searchBookingClients,
} from '../controllers/clientController.js'

import {
  requireSalonRole,
} from '../middleware/roleMiddleware.js'

const router = Router()

router.get(
  '/search',
  requireSalonRole('owner', 'admin', 'employee'),
  searchBookingClients
)

router.get(
  '/',
  requireSalonRole('owner', 'admin'),
  getClients
)

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