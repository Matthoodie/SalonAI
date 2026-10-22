import { Router } from 'express'

import {
  createInvitationController,
} from '../controllers/invitationController.js'

import {
  requireAuthenticatedUser,
} from '../middleware/authenticatedUserMiddleware.js'

import {
  requireCurrentSalon,
} from '../middleware/currentSalonMiddleware.js'

import {
  requireSalonRole,
} from '../middleware/roleMiddleware.js'

export function createInvitationRouter({
  authenticate = requireAuthenticatedUser,
  acceptInvitation,
} = {}) {
  const router = Router()

  const controller = createInvitationController({
    acceptInvitation,
  })

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.use(authenticate)

  router.get(
    '/',
    requireCurrentSalon,
    requireSalonRole('owner', 'admin'),
    controller.list
  )

  router.post(
    '/accept',
    controller.accept
  )

  router.post(
    '/',
    requireCurrentSalon,
    requireSalonRole('owner', 'admin'),
    controller.create
  )

  router.post(
    '/:id/revoke',
    requireCurrentSalon,
    requireSalonRole('owner', 'admin'),
    controller.revoke
  )

  return router
}

export default createInvitationRouter()