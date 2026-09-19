import pool from '../database/pool.js'

import {
  isValidTime,
  timeToMinutes,
} from '../utils/time.js'

import {
  isValidDateKey,
} from '../utils/date.js'

import {
  isValidUtcDateTime,
} from '../utils/dateTime.js'

import {
  findEmployeeForUpdate,
  findEmployeesBySalonId,
  insertEmployee,
  insertEmployeeServices,
  insertEmployeeWorkingHours,
  insertEmployeeDateOverrides,
  insertEmployeeTimeOff,
  insertEmployeeBlockedTimes,
  updateEmployee,
  deleteEmployeeWorkingHours,
  deleteEmployeeDateOverrides,
  deleteEmployeeTimeOff,
  deleteEmployeeBlockedTimes,
  updateEmployeeActive,
  findEmployeeServiceIds,
  deleteEmployeeService,
} from '../repositories/employeeRepository.js'

function validateServiceIds(
  serviceIds
) {
  if (!Array.isArray(serviceIds)) {
    const error = new Error(
      'service_ids must be an array.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidServiceId =
    serviceIds.some(
      (serviceId) =>
        !Number.isSafeInteger(serviceId) ||
        serviceId <= 0
    )

  if (hasInvalidServiceId) {
    const error = new Error(
      'service_ids must contain only positive integers.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const uniqueServiceIds =
    new Set(serviceIds)

  if (
    uniqueServiceIds.size !==
    serviceIds.length
  ) {
    const error = new Error(
      'service_ids must not contain duplicates.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
}

function validateWorkingHours(
  workingHours
) {
  if (!Array.isArray(workingHours)) {
    const error = new Error(
      'working_hours must be an array.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidDayOfWeek =
    workingHours.some(
      (workingHour) =>
        !Number.isSafeInteger(
          workingHour?.day_of_week
        ) ||
        workingHour.day_of_week < 1 ||
        workingHour.day_of_week > 7
    )

  if (hasInvalidDayOfWeek) {
    const error = new Error(
      'working_hours day_of_week must be an integer between 1 and 7.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidStartTime =
    workingHours.some(
      (workingHour) =>
        !isValidTime(
          workingHour?.start_time
        )
    )

  if (hasInvalidStartTime) {
    const error = new Error(
      'working_hours start_time must use HH:MM format.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidEndTime =
    workingHours.some(
      (workingHour) =>
        !isValidTime(
          workingHour?.end_time
        )
    )

  if (hasInvalidEndTime) {
    const error = new Error(
      'working_hours end_time must use HH:MM format.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidTimeRange =
    workingHours.some(
      (workingHour) => {
        const startMinutes =
          timeToMinutes(
            workingHour.start_time
          )

        const endMinutes =
          timeToMinutes(
            workingHour.end_time
          )

        return (
          startMinutes >= endMinutes
        )
      }
    )

  if (hasInvalidTimeRange) {
    const error = new Error(
      'working_hours start_time must be earlier than end_time.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const dayOfWeekValues =
    workingHours.map(
      (workingHour) =>
        workingHour.day_of_week
    )

  const uniqueDayOfWeekValues =
    new Set(dayOfWeekValues)

  if (
    uniqueDayOfWeekValues.size !==
    dayOfWeekValues.length
  ) {
    const error = new Error(
      'working_hours must not contain duplicate day_of_week values.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
}

function validateDateOverrides(
  dateOverrides
) {
  if (!Array.isArray(dateOverrides)) {
    const error = new Error(
      'date_overrides must be an array.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidDate =
    dateOverrides.some(
      (dateOverride) =>
        !isValidDateKey(
          dateOverride?.date
        )
    )

  if (hasInvalidDate) {
    const error = new Error(
      'date_overrides date must be a valid date in YYYY-MM-DD format.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidEnabled =
    dateOverrides.some(
      (dateOverride) =>
        typeof dateOverride?.enabled !==
        'boolean'
    )

  if (hasInvalidEnabled) {
    const error = new Error(
      'date_overrides enabled must be a boolean.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasTimesWhenDisabled =
    dateOverrides.some(
      (dateOverride) =>
        dateOverride.enabled === false &&
        (
          dateOverride.start_time !== null ||
          dateOverride.end_time !== null
        )
    )

  if (hasTimesWhenDisabled) {
    const error = new Error(
      'date_overrides times must be null when enabled is false.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidEnabledStartTime =
    dateOverrides.some(
      (dateOverride) =>
        dateOverride.enabled === true &&
        !isValidTime(
          dateOverride.start_time
        )
    )

  if (hasInvalidEnabledStartTime) {
    const error = new Error(
      'date_overrides start_time must use HH:MM format when enabled is true.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidEnabledEndTime =
    dateOverrides.some(
      (dateOverride) =>
        dateOverride.enabled === true &&
        !isValidTime(
          dateOverride.end_time
        )
    )

  if (hasInvalidEnabledEndTime) {
    const error = new Error(
      'date_overrides end_time must use HH:MM format when enabled is true.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidEnabledTimeRange =
    dateOverrides.some(
      (dateOverride) => {
        if (
          dateOverride.enabled !== true
        ) {
          return false
        }

        const startMinutes =
          timeToMinutes(
            dateOverride.start_time
          )

        const endMinutes =
          timeToMinutes(
            dateOverride.end_time
          )

        return (
          startMinutes >= endMinutes
        )
      }
    )

  if (hasInvalidEnabledTimeRange) {
    const error = new Error(
      'date_overrides start_time must be earlier than end_time.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const dateValues =
    dateOverrides.map(
      (dateOverride) =>
        dateOverride.date
    )

  const uniqueDateValues =
    new Set(dateValues)

  if (
    uniqueDateValues.size !==
    dateValues.length
  ) {
    const error = new Error(
      'date_overrides must not contain duplicate dates.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
}

function validateTimeOff(
  timeOff
) {
  if (!Array.isArray(timeOff)) {
    const error = new Error(
      'time_off must be an array.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidStartDate =
    timeOff.some(
      (timeOffEntry) =>
        !isValidDateKey(
          timeOffEntry?.start_date
        )
    )

  if (hasInvalidStartDate) {
    const error = new Error(
      'time_off start_date must be a valid date in YYYY-MM-DD format.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidEndDate =
    timeOff.some(
      (timeOffEntry) =>
        !isValidDateKey(
          timeOffEntry?.end_date
        )
    )

  if (hasInvalidEndDate) {
    const error = new Error(
      'time_off end_date must be a valid date in YYYY-MM-DD format.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidDateRange =
    timeOff.some(
      (timeOffEntry) =>
        timeOffEntry.start_date >
        timeOffEntry.end_date
    )

  if (hasInvalidDateRange) {
    const error = new Error(
      'time_off start_date must not be after end_date.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const allowedTimeOffTypes =
    new Set([
      'vacation',
      'sick',
      'training',
      'personal',
      'other',
    ])

  const hasInvalidType =
    timeOff.some(
      (timeOffEntry) =>
        !allowedTimeOffTypes.has(
          timeOffEntry?.type
        )
    )

  if (hasInvalidType) {
    const error = new Error(
      'time_off type must be one of: vacation, sick, training, personal, other.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidNote =
    timeOff.some(
      (timeOffEntry) =>
        timeOffEntry?.note !== undefined &&
        timeOffEntry?.note !== null &&
        typeof timeOffEntry.note !==
        'string'
    )

  if (hasInvalidNote) {
    const error = new Error(
      'time_off note must be a string or null.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
}

function validateBlockedTimes(
  blockedTimes
) {
  if (!Array.isArray(blockedTimes)) {
    const error = new Error(
      'blocked_times must be an array.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidStartsAt =
    blockedTimes.some(
      (blockedTime) =>
        !isValidUtcDateTime(
          blockedTime?.starts_at
        )
    )

  if (hasInvalidStartsAt) {
    const error = new Error(
      'blocked_times starts_at must be a valid UTC date-time.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidEndsAt =
    blockedTimes.some(
      (blockedTime) =>
        !isValidUtcDateTime(
          blockedTime?.ends_at
        )
    )

  if (hasInvalidEndsAt) {
    const error = new Error(
      'blocked_times ends_at must be a valid UTC date-time.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const hasInvalidDateTimeRange =
    blockedTimes.some(
      (blockedTime) => {
        const startsAt =
          new Date(
            blockedTime.starts_at
          )

        const endsAt =
          new Date(
            blockedTime.ends_at
          )

        return (
          startsAt.getTime() >=
          endsAt.getTime()
        )
      }
    )

  if (hasInvalidDateTimeRange) {
    const error = new Error(
      'blocked_times starts_at must be earlier than ends_at.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  const allowedBlockedTimeTypes =
    new Set([
      'BREAK',
      'PRIVATE',
      'MEETING',
      'TRAINING',
      'OTHER',
    ])

  const hasInvalidType =
    blockedTimes.some(
      (blockedTime) =>
        !allowedBlockedTimeTypes.has(
          blockedTime?.type
        )
    )

  if (hasInvalidType) {
    const error = new Error(
      'blocked_times type must be one of: BREAK, PRIVATE, MEETING, TRAINING, OTHER.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
  const hasInvalidReason =
    blockedTimes.some(
      (blockedTime) =>
        blockedTime?.reason !== undefined &&
        blockedTime?.reason !== null &&
        typeof blockedTime.reason !==
        'string'
    )

  if (hasInvalidReason) {
    const error = new Error(
      'blocked_times reason must be a string or null.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }
}

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

  if (typeof active !== 'boolean') {
    const error = new Error(
      'active must be a boolean.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  validateServiceIds(
    serviceIds
  )

  validateWorkingHours(
    workingHours
  )

  validateDateOverrides(
    dateOverrides
  )

  validateTimeOff(
    timeOff
  )

  validateBlockedTimes(
    blockedTimes
  )

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
  active,
  serviceIds,
  workingHours,
  dateOverrides,
  timeOff,
  blockedTimes,
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
    name === undefined
      ? undefined
      : String(name || '').trim()

  if (
    name !== undefined &&
    !trimmedName
  ) {
    const error = new Error(
      'Employee name is required.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  if (
    active !== undefined &&
    typeof active !== 'boolean'
  ) {
    const error = new Error(
      'active must be a boolean.'
    )

    error.code = 'VALIDATION_ERROR'
    error.statusCode = 400

    throw error
  }

  if (serviceIds !== undefined) {
    validateServiceIds(serviceIds)
  }

  if (workingHours !== undefined) {
    validateWorkingHours(workingHours)
  }

  if (dateOverrides !== undefined) {
    validateDateOverrides(dateOverrides)
  }

  if (timeOff !== undefined) {
    validateTimeOff(timeOff)
  }

  if (blockedTimes !== undefined) {
    validateBlockedTimes(blockedTimes)
  }

  const client =
    await pool.connect()

  try {
    await client.query('BEGIN')

    const existingEmployee =
      await findEmployeeForUpdate(
        client,
        {
          employeeId,
          salonId,
        }
      )

    if (!existingEmployee) {
      const error = new Error(
        'Employee was not found.'
      )

      error.code =
        'EMPLOYEE_NOT_FOUND'

      error.statusCode = 404

      throw error
    }

    const employee =
      await updateEmployee(
        client,
        {
          employeeId,
          salonId,
          name:
            trimmedName === undefined
              ? existingEmployee.name
              : trimmedName,
          active:
            active === undefined
              ? existingEmployee.active
              : active,
        }
      )

    if (serviceIds !== undefined) {
      const currentServiceIds =
        await findEmployeeServiceIds(
          client,
          employeeId
        )

      const serviceIdsToRemove =
        currentServiceIds.filter(
          (serviceId) =>
            !serviceIds.includes(serviceId)
        )

      const serviceIdsToAdd =
        serviceIds.filter(
          (serviceId) =>
            !currentServiceIds.includes(serviceId)
        )

      for (const serviceId of serviceIdsToRemove) {
        await deleteEmployeeService(
          client,
          {
            employeeId,
            serviceId,
          }
        )
      }

      await insertEmployeeServices(
        client,
        {
          employeeId,
          salonId,
          serviceIds: serviceIdsToAdd,
        }
      )
    }

    if (workingHours !== undefined) {
      await deleteEmployeeWorkingHours(
        client,
        employeeId
      )

      await insertEmployeeWorkingHours(
        client,
        {
          employeeId,
          workingHours,
        }
      )
    }

    if (dateOverrides !== undefined) {
      await deleteEmployeeDateOverrides(
        client,
        employeeId
      )

      await insertEmployeeDateOverrides(
        client,
        {
          employeeId,
          dateOverrides,
        }
      )
    }

    if (timeOff !== undefined) {
      await deleteEmployeeTimeOff(
        client,
        employeeId
      )

      await insertEmployeeTimeOff(
        client,
        {
          employeeId,
          timeOff,
        }
      )
    }

    if (blockedTimes !== undefined) {
      await deleteEmployeeBlockedTimes(
        client,
        employeeId
      )

      await insertEmployeeBlockedTimes(
        client,
        {
          employeeId,
          blockedTimes,
        }
      )
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