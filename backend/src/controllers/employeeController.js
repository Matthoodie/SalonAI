import {
  getEmployeesForSalon,
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