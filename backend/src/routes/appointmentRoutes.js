import { Router } from 'express'

import {
  createAppointment,
  getAppointment,
  getAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from '../controllers/appointmentController.js'

const router = Router()

router.get('/', getAppointments)
router.get('/:id', getAppointment)
router.post('/', createAppointment)
router.patch('/:id/status', updateAppointmentStatus)
router.patch('/:id/schedule', rescheduleAppointment)


export default router