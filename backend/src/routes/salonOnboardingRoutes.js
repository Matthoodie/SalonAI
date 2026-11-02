import { Router } from 'express'
import { requireAuthenticatedUser } from '../middleware/authenticatedUserMiddleware.js'
import { requireCurrentSalon } from '../middleware/currentSalonMiddleware.js'
import { createSalonOnboardingController } from '../controllers/salonOnboardingController.js'
export function createSalonOnboardingRouter({ authenticate = requireAuthenticatedUser,
  selectSalon = requireCurrentSalon, service } = {}) {
  const router = Router(), controller = createSalonOnboardingController(service)
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.use(authenticate)
  // Creation must work before a salon context exists. No user/salon identity in its body.
  router.get('/eligibility', controller.eligibility)
  router.post('/salons', controller.create)
  router.get('/status', selectSalon, controller.status)
  return router
}
export default createSalonOnboardingRouter()
