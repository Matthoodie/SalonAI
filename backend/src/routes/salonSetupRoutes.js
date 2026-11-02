import { Router } from 'express'
import { requireSalonRole } from '../middleware/roleMiddleware.js'
import { getSalonSetupController, updateSalonSetupController } from '../controllers/salonSetupController.js'
const router = Router()
router.use(requireSalonRole('owner'))
router.get('/', getSalonSetupController)
router.put('/', updateSalonSetupController)
export default router
