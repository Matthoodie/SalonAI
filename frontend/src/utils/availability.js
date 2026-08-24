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

export function isEmployeeAvailable({
  employeeId,
  date,
  startTime,
  durationMinutes,
  appointments = [],
  excludeAppointmentId = null,
}) {
  if (
    !employeeId ||
    !date ||
    !startTime ||
    !durationMinutes
  ) {
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