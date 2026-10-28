import { parseAppointmentServiceIds } from '../utils/appointmentServices.js'
import {
  changeAppointmentServices,
  changeAppointmentClient,
  changeAppointmentStatus,
  getAllAppointments,
  getAppointmentById,
  rescheduleAppointment as rescheduleAppointmentService,
} from '../services/appointmentService.js'

import {
  createAppointmentBooking,
} from '../services/appointmentBookingService.js'

import {
  SALON_PERMISSION_KEYS,
} from '../permissions/salonPermissions.js'

import {
  resolveAppointmentPermissionScope,
} from '../services/salonPermissionService.js'

export async function getAppointments(req, res, next) {
    try {
        const salonId =
          Number(req.currentSalon?.id)

        const isEmployee =
          req.currentMembership?.role ===
          'employee'

       const employeeId =
         isEmployee
           ? Number(
            req.currentMembership
                ?.employeeId
        )
        : null

        if (
            !Number.isSafeInteger(salonId) ||
            salonId <= 0
        ) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_SALON_ID',
                    message:
                        'salonId must be a positive integer.',
                },
            })
        }

        if (
    isEmployee &&
    (
        !Number.isSafeInteger(
            employeeId
        ) ||
        employeeId <= 0
    )
) {
    const error = new Error(
        'Employee membership is missing a valid employee identity.'
    )

    error.code =
        'EMPLOYEE_MEMBERSHIP_IDENTITY_REQUIRED'

    error.statusCode = 500

    throw error
}

       const appointments =
    await getAllAppointments(
        salonId,
        employeeId
    )

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

        const salonId =
           Number(req.currentSalon?.id)

        const isEmployee =
    req.currentMembership?.role ===
    'employee'

const employeeId =
    isEmployee
        ? Number(
            req.currentMembership
                ?.employeeId
        )
        : null

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_APPOINTMENT_ID',
                    message: 'Appointment ID must be a positive integer.',
                },
            })
        }

    if (
    isEmployee &&
    (
        !Number.isSafeInteger(
            employeeId
        ) ||
        employeeId <= 0
    )
) {
    const error = new Error(
        'Employee membership is missing a valid employee identity.'
    )

    error.code =
        'EMPLOYEE_MEMBERSHIP_IDENTITY_REQUIRED'

    error.statusCode = 500

    throw error
}

const appointment =
    await getAppointmentById(
        id,
        salonId,
        employeeId
    )

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
      client_id,
      new_client,
      employee_id,
      service_id,
      service_ids,
      starts_at,
      notes,
    } = req.body ?? {}

    function validationError(message) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message,
        },
      })
    }

    const hasExistingClient = client_id !== undefined
    const hasNewClient = new_client !== undefined

    if (hasExistingClient === hasNewClient) {
      return validationError(
        'Provide either client_id or new_client, but not both.'
      )
    }

    if (
      hasNewClient &&
      (
        new_client === null ||
        typeof new_client !== 'object' ||
        Array.isArray(new_client)
      )
    ) {
      return validationError(
        'new_client must be an object.'
      )
    }

    const salonId = Number(req.currentSalon?.id)
    const requestedEmployeeId = Number(employee_id)
    const selection = parseAppointmentServiceIds({ service_id, service_ids })
    if (selection.error) return validationError(selection.error.message)
    const serviceId = selection.data[0]
    const clientId = hasExistingClient
      ? Number(client_id)
      : undefined

    const requiredIds = {
      salon_id: salonId,
      employee_id: requestedEmployeeId,
      service_id: serviceId,
    }

    if (hasExistingClient) {
      requiredIds.client_id = clientId
    }

    for (const [field, value] of Object.entries(requiredIds)) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        return validationError(
          `${field} must be a positive integer.`
        )
      }
    }

    const permissionScope =
      await resolveAppointmentPermissionScope({
        salonId,
        membership: req.currentMembership,
        permissionKey: SALON_PERMISSION_KEYS.APPOINTMENT_CREATE,
      })

    if (
      permissionScope.employeeId !== null &&
      requestedEmployeeId !== permissionScope.employeeId
    ) {
      return res.status(403).json({
        error: {
          code: 'EMPLOYEE_APPOINTMENT_SCOPE_VIOLATION',
          message: 'You can only create appointments for yourself.',
        },
      })
    }

    if (
      typeof starts_at !== 'string' ||
      Number.isNaN(Date.parse(starts_at))
    ) {
      return validationError(
        'starts_at must be a valid date-time.'
      )
    }

    if (
      notes !== undefined &&
      notes !== null &&
      (
        typeof notes !== 'string' ||
        notes.length > 1000
      )
    ) {
      return validationError(
        'notes must be a string with at most 1000 characters.'
      )
    }

    const result = await createAppointmentBooking({
      salon_id: salonId,
      client_id: clientId,
      newClient: new_client,
      employee_id: requestedEmployeeId,
      service_ids: selection.data,
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

    return res.status(201).json({
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
        const id =
            Number(req.params.id)

        if (
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                error: {
                    code:
                        'INVALID_APPOINTMENT_ID',
                    message:
                        'Appointment ID must be a positive integer.',
                },
            })
        }

        const salonId =
            Number(
                req.currentSalon?.id
            )

        const permissionScope =
            await resolveAppointmentPermissionScope({
                salonId,
                membership:
                    req.currentMembership,
                permissionKey:
                    SALON_PERMISSION_KEYS
                        .APPOINTMENT_CHANGE_STATUS,
            })

        const {
            status,
        } = req.body

        if (
            typeof status !== 'string'
        ) {
            return res.status(400).json({
                error: {
                    code:
                        'VALIDATION_ERROR',
                    message:
                        'status must be a string.',
                },
            })
        }

        const result =
            await changeAppointmentStatus(
                id,
                salonId,
                status,
                permissionScope.employeeId
            )

        if (result.error) {
            return res
                .status(
                    result.error.status
                )
                .json({
                    error: {
                        code:
                            result.error.code,
                        message:
                            result.error.message,
                    },
                })
        }

        return res.status(200).json({
            data: result.data,
        })
    } catch (error) {
        next(error)
    }
}

export async function rescheduleAppointment(
    req,
    res,
    next
) {
    try {
        const id =
            Number(req.params.id)

        if (
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                error: {
                    code:
                        'INVALID_APPOINTMENT_ID',
                    message:
                        'Appointment ID must be a positive integer.',
                },
            })
        }

        const salonId =
            Number(
                req.currentSalon?.id
            )

        const permissionScope =
            await resolveAppointmentPermissionScope({
                salonId,
                membership:
                    req.currentMembership,
                permissionKey:
                    SALON_PERMISSION_KEYS
                        .APPOINTMENT_RESCHEDULE,
            })

        const {
            starts_at,
        } = req.body

        if (
            typeof starts_at !==
                'string' ||
            Number.isNaN(
                Date.parse(starts_at)
            )
        ) {
            return res.status(400).json({
                error: {
                    code:
                        'VALIDATION_ERROR',
                    message:
                        'starts_at must be a valid date-time.',
                },
            })
        }

        const result =
            await rescheduleAppointmentService(
                id,
                salonId,
                starts_at,
                permissionScope.employeeId
            )

        if (result.error) {
            return res
                .status(
                    result.error.status
                )
                .json({
                    error: {
                        code:
                            result.error.code,
                        message:
                            result.error.message,
                    },
                })
        }

        return res.status(200).json({
            data: result.data,
        })
    } catch (error) {
        next(error)
    }
}

export async function updateAppointmentClient(
    req,
    res,
    next
) {
    try {
        const appointmentId =
            Number(req.params.id)

        const salonId =
            Number(
                req.currentSalon?.id
            )

        const clientId =
            Number(
                req.body?.client_id
            )

        if (
            !Number.isSafeInteger(
                appointmentId
            ) ||
            appointmentId <= 0
        ) {
            return res.status(400).json({
                error: {
                    code:
                        'INVALID_APPOINTMENT_ID',
                    message:
                        'Appointment ID must be a positive integer.',
                },
            })
        }

        const permissionScope =
            await resolveAppointmentPermissionScope({
                salonId,
                membership:
                    req.currentMembership,
                permissionKey:
                    SALON_PERMISSION_KEYS
                        .APPOINTMENT_CHANGE_CLIENT,
            })

        if (
            req.body?.client_id ===
                undefined ||
            req.body?.client_id ===
                null ||
            !Number.isSafeInteger(
                clientId
            ) ||
            clientId <= 0
        ) {
            return res.status(400).json({
                error: {
                    code:
                        'INVALID_CLIENT_ID',
                    message:
                        'client_id must be a positive integer.',
                },
            })
        }

        const result =
            await changeAppointmentClient(
                appointmentId,
                salonId,
                clientId,
                permissionScope.employeeId
            )

        if (result.error) {
            return res
                .status(
                    result.error.status
                )
                .json({
                    error: {
                        code:
                            result.error.code,
                        message:
                            result.error.message,
                    },
                })
        }

        return res.status(200).json({
            data: result.data,
        })
    } catch (error) {
        next(error)
    }
}

export async function updateAppointmentServices(req, res, next) {
  try {
    const id = Number(req.params.id)
    const salonId = Number(req.currentSalon?.id)
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(salonId) || salonId <= 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid appointment or salon ID.' } })
    }
    const selection = parseAppointmentServiceIds({
      service_id: req.body?.service_id, service_ids: req.body?.service_ids,
    })
    if (selection.error) return res.status(400).json({ error: selection.error })
    const scope = await resolveAppointmentPermissionScope({
      salonId,
      membership: req.currentMembership,
      permissionKey: SALON_PERMISSION_KEYS.APPOINTMENT_RESCHEDULE,
    })
    const result = await changeAppointmentServices(id, salonId, selection.data, scope.employeeId)
    if (result.error) return res.status(result.error.status).json({ error: result.error })
    return res.status(200).json({ data: result.data })
  } catch (error) { next(error) }
}
