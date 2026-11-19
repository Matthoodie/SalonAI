import { supportOperationsService } from '../services/supportOperationsService.js'
import express, { Router } from 'express'
import { requireAuthenticatedUser } from '../middleware/authenticatedUserMiddleware.js'
import { supportId, validateSupportListQuery } from '../utils/supportTicketValidation.js'
import { supportTicketService, supportError } from '../services/supportTicketService.js'
import { supportNoStore, supportErrorHandler } from '../middleware/supportErrorHandler.js'
export function createSupportTicketRouter({authenticate = requireAuthenticatedUser, service = supportTicketService, conversation = supportOperationsService} = {}) {
  const router = Router()
  router.use(supportNoStore, authenticate)
  router.use((req, res, next) => {
    if (!req.currentUser) throw supportError('UNAUTHENTICATED', 401)
    if (req.currentUser.active !== true) throw supportError('SUPPORT_FORBIDDEN', 403)
    req.supportUserId = supportId(req.currentUser.id, 'user_id')
    next()
  })
  router.post('/', (req, res, next) => {
    if (!req.is('application/json')) throw supportError('SUPPORT_CONTENT_TYPE', 415)
    next()
  }, express.json({limit: '32kb', inflate: false}), async (req, res) => {
    validateSupportListQuery(req.query) // No creation query parameters are supported.
    if (Object.keys(req.query).length) throw supportError('SUPPORT_VALIDATION_ERROR', 400)
    const result = await service.create(req.supportUserId, req.body)
    res.status(result.replayed ? 200 : 201).json({data: result.ticket, replayed: result.replayed})
  })
  router.get('/', async (req, res) => res.json({data: await service.list(req.supportUserId, req.query)}))
  router.get('/:id/messages', async (req, res) => res.json({data: await conversation.messages(req.supportUserId, req.params.id, req.query, false)}))
  router.get('/:id', async (req, res) => {
    if (Object.keys(req.query).length) throw supportError('SUPPORT_VALIDATION_ERROR', 400)
    res.json({data: await service.detail(req.supportUserId, req.params.id)})
  })
  router.use((req, res) => res.status(404).json({error: {code: 'SUPPORT_NOT_FOUND', message: 'Support resource was not found.'}}))
  router.use(supportErrorHandler)
  return router
}
export default createSupportTicketRouter()
