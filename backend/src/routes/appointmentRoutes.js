import { requireSalonRole } from '../middleware/roleMiddleware.js'
import { Router } from 'express'

import {
  createAppointment,
  getAppointment,
  getAppointments,
  rescheduleAppointment,
  updateAppointmentClient,
  updateAppointmentStatus,
  updateAppointmentServices,
} from '../controllers/appointmentController.js'

const router = Router()

router.get('/', getAppointments)
router.get('/:id', getAppointment)
router.post('/', createAppointment)
router.patch('/:id/status', updateAppointmentStatus)
router.patch('/:id/schedule', rescheduleAppointment)
router.patch('/:id/client', updateAppointmentClient)
router.patch('/:id/services', requireSalonRole('owner', 'admin'), updateAppointmentServices)


export default router
