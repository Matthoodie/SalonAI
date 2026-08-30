import { Router } from 'express'

import {
  createAppointment,
  getAppointment,
  getAppointments,
} from '../controllers/appointmentController.js'

const router = Router()

router.get('/', getAppointments)
router.get('/:id', getAppointment)
router.post('/', createAppointment)

export default router