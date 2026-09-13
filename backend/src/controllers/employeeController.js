import {
  getEmployeesForSalon,
  createEmployeeForSalon,
  updateEmployeeForSalon,
  updateEmployeeActiveForSalon,
} from '../services/employeeService.js'

export async function getEmployees(
  req,
  res,
  next
) {
  try {
    const salonId =
      Number(req.query.salon_id)

    if (
      !Number.isSafeInteger(salonId) ||
      salonId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'salon_id must be a positive integer.',
        },
      })
    }

    const employees =
      await getEmployeesForSalon(
        salonId
      )

    res.status(200).json({
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
      Number(req.body.salon_id)

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
      Number(req.body.salon_id)

    const employee =
      await updateEmployeeForSalon({
        employeeId,
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
      Number(req.body.salon_id)

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