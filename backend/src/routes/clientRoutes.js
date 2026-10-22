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

import {
  clientSearchRateLimit,
} from '../middleware/clientSearchRateLimit.js'

const router = Router()

router.get(
  '/search',
  requireSalonRole('owner', 'admin', 'employee'),
  clientSearchRateLimit,
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