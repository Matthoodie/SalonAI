import {
  changeAppointmentStatus,
  getAllAppointments,
  getAppointmentById,
  prepareAppointmentCreation,
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

export async function createAppointment(req, res, next) {
    try {
        const {
            salon_id,
            client_id,
            employee_id,
            service_id,
            starts_at,
            notes,
        } = req.body

        const requiredIds = {
            salon_id,
            client_id,
            employee_id,
            service_id,
        }

        for (const [field, value] of Object.entries(requiredIds)) {
            const numericValue = Number(value)

            if (
                !Number.isSafeInteger(numericValue) ||
                numericValue <= 0
            ) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `${field} must be a positive integer.`,
                    },
                })
            }
        }

        if (
            typeof starts_at !== 'string' ||
            Number.isNaN(Date.parse(starts_at))
        ) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'starts_at must be a valid date-time.',
                },
            })
        }

        if (
            notes !== undefined &&
            notes !== null &&
            (
                typeof notes !== 'string' ||
                notes.length > 1000
            )
        ) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message:
                        'notes must be a string with at most 1000 characters.',
                },
            })
        }

        const result = await prepareAppointmentCreation({
            salon_id,
            client_id,
            employee_id,
            service_id,
            starts_at,
            notes,
        })

        if (result.error) {
            return res.status(result.error.status).json({
                error: {
                    code: result.error.code,
                    message: result.error.message,
                },
            })
        }

        res.status(201).json({
            data: result.data,
        })
    } catch (error) {
        next(error)
    }
}

export async function updateAppointmentStatus(
    req,
    res,
    next
) {
    try {
        const id = Number(req.params.id)

        if (
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_APPOINTMENT_ID',
                    message:
                        'Appointment ID must be a positive integer.',
                },
            })
        }

        const { status } = req.body

        if (typeof status !== 'string') {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message:
                        'status must be a string.',
                },
            })
        }

        const result =
            await changeAppointmentStatus(
                id,
                status
            )

        if (result.error) {
            return res
                .status(result.error.status)
                .json({
                    error: {
                        code: result.error.code,
                        message:
                            result.error.message,
                    },
                })
        }

        res.status(200).json({
            data: result.data,
        })
    } catch (error) {
        next(error)
    }
}