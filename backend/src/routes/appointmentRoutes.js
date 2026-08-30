import { Router } from 'express'

import {
  createAppointment,
  getAppointment,
  getAppointments,
  updateAppointmentStatus,
} from '../controllers/appointmentController.js'

const router = Router()

router.get('/', getAppointments)
router.get('/:id', getAppointment)
router.post('/', createAppointment)
router.patch('/:id/status', updateAppointmentStatus)

export default router