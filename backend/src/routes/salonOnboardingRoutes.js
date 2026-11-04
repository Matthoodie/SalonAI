import { Router } from 'express'
import { requireAuthenticatedUser } from '../middleware/authenticatedUserMiddleware.js'
import { requireCurrentSalon } from '../middleware/currentSalonMiddleware.js'
import { createSalonOnboardingController } from '../controllers/salonOnboardingController.js'
export function createSalonOnboardingRouter({ authenticate = requireAuthenticatedUser,
  selectSalon = requireCurrentSalon, service, readiness } = {}) {
  const router = Router(), controller = createSalonOnboardingController(service, readiness)
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.use(authenticate)
  // Creation must work before a salon context exists. No user/salon identity in its body.
  router.get('/eligibility', controller.eligibility)
  router.post('/salons', controller.create)
  router.get('/status', selectSalon, controller.status)
  router.get('/readiness', selectSalon, controller.readiness)
  router.post('/complete', selectSalon, controller.complete)
  return router
}
export default createSalonOnboardingRouter()
