function timeToMinutes(time) {
  if (!time) {
    return null
  }

  const [hours, minutes] =
    time.split(':').map(Number)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null
  }

  return hours * 60 + minutes
}

export const AVAILABILITY_REASONS = {
  INVALID_INPUT: 'INVALID_INPUT',
  DAY_OFF: 'DAY_OFF',
  OUTSIDE_WORKING_HOURS: 'OUTSIDE_WORKING_HOURS',
  APPOINTMENT_COLLISION: 'APPOINTMENT_COLLISION',
}

function getWeekDayKey(date) {
  if (!date) {
    return null
  }

  const [year, month, day] =
    date.split('-').map(Number)

  if (
    !year ||
    !month ||
    !day
  ) {
    return null
  }

  const localDate = new Date(
    year,
    month - 1,
    day
  )

  const weekDayKeys = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]

  return weekDayKeys[
    localDate.getDay()
  ]
}

function isWithinWorkingHours({
  date,
  startTime,
  durationMinutes,
  workingHours,
}) {
  if (!workingHours) {
    return true
  }

  const weekDayKey =
    getWeekDayKey(date)

  if (!weekDayKey) {
    return false
  }

  const daySchedule =
    workingHours[weekDayKey]

  if (
    !daySchedule ||
    !daySchedule.enabled
  ) {
    return false
  }

  const workStartMinutes =
    timeToMinutes(
      daySchedule.startTime
    )

  const workEndMinutes =
    timeToMinutes(
      daySchedule.endTime
    )

  const appointmentStartMinutes =
    timeToMinutes(startTime)

  if (
    workStartMinutes === null ||
    workEndMinutes === null ||
    appointmentStartMinutes === null
  ) {
    return false
  }

  const appointmentEndMinutes =
    appointmentStartMinutes +
    Number(durationMinutes)

  return (
    appointmentStartMinutes >=
      workStartMinutes &&
    appointmentEndMinutes <=
      workEndMinutes
  )
}

export function checkEmployeeAvailability({
  employeeId,
  date,
  startTime,
  durationMinutes,
  appointments = [],
  excludeAppointmentId = null,
  workingHours = null,
}) {
  if (
    !employeeId ||
    !date ||
    !startTime ||
    !durationMinutes
  ) {
    return {
      available: false,
      reason:
        AVAILABILITY_REASONS.INVALID_INPUT,
    }
  }

  const weekDayKey =
    getWeekDayKey(date)

  if (
    workingHours &&
    weekDayKey &&
    (
      !workingHours[weekDayKey] ||
      !workingHours[weekDayKey].enabled
    )
  ) {
    return {
      available: false,
      reason:
        AVAILABILITY_REASONS.DAY_OFF,
    }
  }

  const isInsideWorkingHours =
    isWithinWorkingHours({
      date,
      startTime,
      durationMinutes,
      workingHours,
    })

  if (!isInsideWorkingHours) {
    return {
      available: false,
      reason:
        AVAILABILITY_REASONS
          .OUTSIDE_WORKING_HOURS,
    }
  }

  const candidateStartMinutes =
    timeToMinutes(startTime)

  if (candidateStartMinutes === null) {
    return {
      available: false,
      reason:
        AVAILABILITY_REASONS.INVALID_INPUT,
    }
  }

  const candidateEndMinutes =
    candidateStartMinutes +
    Number(durationMinutes)

  const hasCollision =
    appointments.some((appointment) => {
      const isSameEmployee =
        String(appointment.employeeId) ===
        String(employeeId)

      const isSameDate =
        appointment.date === date

      const isExcludedAppointment =
        excludeAppointmentId !== null &&
        appointment.id ===
          excludeAppointmentId

      if (
        !isSameEmployee ||
        !isSameDate ||
        isExcludedAppointment
      ) {
        return false
      }

      const existingStartMinutes =
        timeToMinutes(
          appointment.time
        )

      if (existingStartMinutes === null) {
        return false
      }

      const existingDuration =
        Number(
          appointment.serviceDurationMinutes
        ) || 0

      if (existingDuration <= 0) {
        return (
          appointment.time === startTime
        )
      }

      const existingEndMinutes =
        existingStartMinutes +
        existingDuration

      return (
        candidateStartMinutes <
          existingEndMinutes &&
        candidateEndMinutes >
          existingStartMinutes
      )
    })

  if (hasCollision) {
    return {
      available: false,
      reason:
        AVAILABILITY_REASONS
          .APPOINTMENT_COLLISION,
    }
  }

  return {
    available: true,
    reason: null,
  }
}

export function isEmployeeAvailable({
  employeeId,
  date,
  startTime,
  durationMinutes,
  appointments = [],
  excludeAppointmentId = null,
  workingHours = null,
}) {
  const result =
    checkEmployeeAvailability({
      employeeId,
      date,
      startTime,
      durationMinutes,
      appointments,
      excludeAppointmentId,
      workingHours,
    })

  return result.available
}