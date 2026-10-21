export function canUseAppointmentPermission(
  authContext,
  permissionKey,
  employeeId
) {
  const membership = authContext?.membership

  if (
    authContext?.authenticated !== true ||
    membership?.active !== true ||
    !['owner', 'admin', 'employee'].includes(membership.role)
  ) {
    return false
  }

  const value = authContext.permissions?.[permissionKey]

  if (value === 'all') {
    return membership.role !== 'employee'
  }

  if (value !== 'self') {
    return false
  }

  const ownEmployeeId = Number(membership.employee_id)
  const targetEmployeeId = Number(employeeId)

  return (
    Number.isSafeInteger(ownEmployeeId) &&
    ownEmployeeId > 0 &&
    Number.isSafeInteger(targetEmployeeId) &&
    targetEmployeeId > 0 &&
    ownEmployeeId === targetEmployeeId
  )
}

export function canEditAppointment(authContext, appointment) {
  if (!appointment) {
    return false
  }

  return (
    canUseAppointmentPermission(
      authContext,
      'appointment.reschedule',
      appointment.employeeId
    ) ||
    canUseAppointmentPermission(
      authContext,
      'appointment.change_client',
      appointment.employeeId
    )
  )
}