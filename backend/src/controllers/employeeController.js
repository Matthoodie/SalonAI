import {
  getEmployeesForSalon,
  createEmployeeForSalon,
  updateEmployeeForSalon,
  updateEmployeeActiveForSalon,
} from '../services/employeeService.js'

export async function getEmployees(req, res, next) {
  try {
    const salonId = Number(req.currentSalon?.id)
    const membership = req.currentMembership

    if (
      !Number.isSafeInteger(salonId) ||
      salonId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'salon_id must be a positive integer.',
        },
      })
    }

    if (!membership) {
      const error = new Error(
        'Salon membership context is required.'
      )

      error.code = 'SALON_MEMBERSHIP_CONTEXT_REQUIRED'
      error.statusCode = 500

      throw error
    }

    if (
      !['owner', 'admin', 'employee'].includes(membership.role)
    ) {
      return res.status(403).json({
        error: {
          code: 'INVALID_SALON_ROLE',
          message: 'The salon role is not supported.',
        },
      })
    }

    let employeeId = null

    if (membership.role === 'employee') {
      employeeId = Number(membership.employeeId)

      if (
        !Number.isSafeInteger(employeeId) ||
        employeeId <= 0
      ) {
        const error = new Error(
          'Employee membership is missing a valid employee identity.'
        )

        error.code = 'EMPLOYEE_MEMBERSHIP_IDENTITY_REQUIRED'
        error.statusCode = 500

        throw error
      }
    }

    const employees = await getEmployeesForSalon(
      salonId,
      employeeId
    )

    return res.status(200).json({
      data: employees,
    })
  } catch (error) {
    next(error)
  }
}

export async function createEmployee(
  req,
  res,
  next
) {
  try {
const salonId =
      Number(req.currentSalon?.id)

    const employee =
      await createEmployeeForSalon({
        salonId,
        name: req.body.name,
        active:
          req.body.active ?? true,
        serviceIds:
          req.body.service_ids ?? [],
        workingHours:
          req.body.working_hours ?? [],
        dateOverrides:
          req.body.date_overrides ?? [],
        timeOff:
          req.body.time_off ?? [],
        blockedTimes:
          req.body.blocked_times ?? [],
      })

    res.status(201).json({
      data: employee,
    })
  } catch (error) {
    next(error)
  }
}

export async function updateEmployee(
  req,
  res,
  next
) {
  try {
    const employeeId =
      Number(req.params.id)

const salonId =
      Number(req.currentSalon?.id)

    const employee =
      await updateEmployeeForSalon({
        employeeId,
        salonId,
        name: req.body.name,
        active: req.body.active,
        serviceIds: req.body.service_ids,
        workingHours: req.body.working_hours,
        dateOverrides: req.body.date_overrides,
        timeOff: req.body.time_off,
        blockedTimes: req.body.blocked_times,
      })

    res.status(200).json({
      data: employee,
    })
  } catch (error) {
    next(error)
  }
}

export async function updateEmployeeActive(
  req,
  res,
  next
) {
  try {
    const employeeId =
      Number(req.params.id)

const salonId =
      Number(req.currentSalon?.id)

    const employee =
      await updateEmployeeActiveForSalon({
        employeeId,
        salonId,
        active: req.body.active,
      })

    res.status(200).json({
      data: employee,
    })
  } catch (error) {
    next(error)
  }
}