import {
  getAllAppointments,
  getAppointmentById,
} from '../services/appointmentService.js'

export async function getAppointments(req, res, next) {
  try {
    const appointments = await getAllAppointments()

    res.status(200).json({
      data: appointments,
    })
  } catch (error) {
    next(error)
  }
}

export async function getAppointment(req, res, next) {
  try {
    const id = Number(req.params.id)

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_APPOINTMENT_ID',
          message: 'Appointment ID must be a positive integer.',
        },
      })
    }

    const appointment = await getAppointmentById(id)

    if (!appointment) {
      return res.status(404).json({
        error: {
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Appointment was not found.',
        },
      })
    }

    res.status(200).json({
      data: appointment,
    })
  } catch (error) {
    next(error)
  }
}