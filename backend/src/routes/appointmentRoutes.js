import { Router } from 'express'

import {
  createAppointment,
  getAppointment,
  getAppointments,
  rescheduleAppointment,
  updateAppointmentClient,
  updateAppointmentStatus,
} from '../controllers/appointmentController.js'

const router = Router()

router.get('/', getAppointments)
router.get('/:id', getAppointment)
router.post('/', createAppointment)
router.patch('/:id/status', updateAppointmentStatus)
router.patch('/:id/schedule', rescheduleAppointment)
router.patch('/:id/client', updateAppointmentClient)


export default router