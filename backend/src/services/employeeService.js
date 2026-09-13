import pool from '../database/pool.js'

import {
  findEmployeesBySalonId,
  insertEmployee,
  insertEmployeeServices,
  insertEmployeeWorkingHours,
  insertEmployeeDateOverrides,
  insertEmployeeTimeOff,
  insertEmployeeBlockedTimes,
  updateEmployee,
  deleteEmployeeServices,
  deleteEmployeeWorkingHours,
  deleteEmployeeDateOverrides,
  deleteEmployeeTimeOff,
  deleteEmployeeBlockedTimes,
  updateEmployeeActive,
} from '../repositories/employeeRepository.js'

export async function getEmployeesForSalon(
  salonId
) {
  return findEmployeesBySalonId(
    salonId
  )
}

export async function createEmployeeForSalon({
  salonId,
  name,
  active = true,
  serviceIds = [],
  workingHours = [],
  dateOverrides = [],
  timeOff = [],
  blockedTimes = [],
}) {
  if (
    !Number.isSafeInteger(salonId) ||
    salonId <= 0
  ) {
    const error = new Error(
      'salon_id must be a positive integer.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const trimmedName =
    String(name || '').trim()

  if (!trimmedName) {
    const error = new Error(
      'Employee name is required.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const client =
    await pool.connect()

  try {
    await client.query('BEGIN')

    const employee =
      await insertEmployee(
        client,
        {
          salonId,
          name: trimmedName,
          active,
        }
      )

    await insertEmployeeServices(
      client,
      {
        employeeId: employee.id,
        salonId,
        serviceIds,
      }
    )

    await insertEmployeeWorkingHours(
      client,
      {
        employeeId: employee.id,
        workingHours,
      }
    )

    await insertEmployeeDateOverrides(
      client,
      {
        employeeId: employee.id,
        dateOverrides,
      }
    )

    await insertEmployeeTimeOff(
      client,
      {
        employeeId: employee.id,
        timeOff,
      }
    )

    await insertEmployeeBlockedTimes(
      client,
      {
        employeeId: employee.id,
        blockedTimes,
      }
    )

    await client.query('COMMIT')

    return employee
  } catch (error) {
    await client.query('ROLLBACK')

    throw error
  } finally {
    client.release()
  }
}

export async function updateEmployeeForSalon({
  employeeId,
  salonId,
  name,
  active = true,
  serviceIds = [],
  workingHours = [],
  dateOverrides = [],
  timeOff = [],
  blockedTimes = [],
}) {
  if (
    !Number.isSafeInteger(employeeId) ||
    employeeId <= 0
  ) {
    const error = new Error(
      'employee_id must be a positive integer.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  if (
    !Number.isSafeInteger(salonId) ||
    salonId <= 0
  ) {
    const error = new Error(
      'salon_id must be a positive integer.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const trimmedName =
    String(name || '').trim()

  if (!trimmedName) {
    const error = new Error(
      'Employee name is required.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const client =
    await pool.connect()

  try {
    await client.query('BEGIN')

    const employee =
      await updateEmployee(
        client,
        {
          employeeId,
          salonId,
          name: trimmedName,
          active,
        }
      )

    if (!employee) {
      const error = new Error(
        'Employee was not found.'
      )

      error.code =
        'EMPLOYEE_NOT_FOUND'

      error.statusCode = 404

      throw error
    }

    await deleteEmployeeServices(
      client,
      employeeId
    )

    await deleteEmployeeWorkingHours(
      client,
      employeeId
    )

    await deleteEmployeeDateOverrides(
      client,
      employeeId
    )

    await deleteEmployeeTimeOff(
      client,
      employeeId
    )

    await deleteEmployeeBlockedTimes(
      client,
      employeeId
    )

    await insertEmployeeServices(
      client,
      {
        employeeId,
        salonId,
        serviceIds,
      }
    )

    await insertEmployeeWorkingHours(
      client,
      {
        employeeId,
        workingHours,
      }
    )

    await insertEmployeeDateOverrides(
      client,
      {
        employeeId,
        dateOverrides,
      }
    )

    await insertEmployeeTimeOff(
      client,
      {
        employeeId,
        timeOff,
      }
    )

    await insertEmployeeBlockedTimes(
      client,
      {
        employeeId,
        blockedTimes,
      }
    )

    await client.query('COMMIT')

    return employee
  } catch (error) {
    await client.query('ROLLBACK')

    throw error
  } finally {
    client.release()
  }
}

export async function updateEmployeeActiveForSalon({
  employeeId,
  salonId,
  active,
}) {
  if (
    !Number.isSafeInteger(employeeId) ||
    employeeId <= 0
  ) {
    const error = new Error(
      'employee_id must be a positive integer.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  if (
    !Number.isSafeInteger(salonId) ||
    salonId <= 0
  ) {
    const error = new Error(
      'salon_id must be a positive integer.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  if (typeof active !== 'boolean') {
    const error = new Error(
      'active must be a boolean.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const client =
    await pool.connect()

  try {
    await client.query('BEGIN')

    const employee =
      await updateEmployeeActive(
        client,
        {
          employeeId,
          salonId,
          active,
        }
      )

    if (!employee) {
      const error = new Error(
        'Employee was not found.'
      )

      error.code =
        'EMPLOYEE_NOT_FOUND'

      error.statusCode = 404

      throw error
    }

    await client.query('COMMIT')

    return employee
  } catch (error) {
    await client.query('ROLLBACK')

    throw error
  } finally {
    client.release()
  }
}