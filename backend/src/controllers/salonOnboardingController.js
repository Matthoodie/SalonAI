import { salonCreationService } from '../services/salonCreationService.js'
import { creationError, creationUserId } from '../utils/salonCreationValidation.js'
export function createSalonOnboardingController(service = salonCreationService) {
  function authenticatedId(req) {
    if (req.currentUser?.active !== true) throw creationError('Potreban je aktivan prijavljeni račun.', 'SALON_CREATION_UNAUTHENTICATED', 401)
    return creationUserId(req.currentUser.id)
  }
  return {
    async eligibility(req, res, next) {
      try { res.json({ data: await service.eligibility(authenticatedId(req)) }) } catch (error) { next(error) }
    },
    async create(req, res, next) {
      try {
        const data = await service.create(authenticatedId(req), req.body)
        res.status(data.replayed ? 200 : 201).json({ data })
      } catch (error) { next(error) }
    },
    async status(req, res, next) {
      try { res.json({ data: await service.status(authenticatedId(req), creationUserId(req.currentSalon?.id)) }) }
      catch (error) { next(error) }
    },
  }
}
