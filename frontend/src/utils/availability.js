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

export function isEmployeeAvailable({
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
    return false
  }

  const isInsideWorkingHours =
  isWithinWorkingHours({
    date,
    startTime,
    durationMinutes,
    workingHours,
  })

if (!isInsideWorkingHours) {
  return false
}

  const candidateStartMinutes =
    timeToMinutes(startTime)

  if (candidateStartMinutes === null) {
    return false
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

  return !hasCollision
}