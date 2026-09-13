export async function updateAppointmentStatus(
  appointmentId,
  status
) {
  const response = await fetch(
    `/api/appointments/${appointmentId}/status`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        status,
      }),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to update appointment status.'
    )

    error.code =
      responseBody?.error?.code ||
      'APPOINTMENT_STATUS_UPDATE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function rescheduleAppointment(
  appointmentId,
  startsAt
) {
  const response = await fetch(
    `/api/appointments/${appointmentId}/schedule`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        starts_at: startsAt,
      }),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to reschedule appointment.'
    )

    error.code =
      responseBody?.error?.code ||
      'APPOINTMENT_RESCHEDULE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function createAppointment({
  salonId,
  clientId,
  employeeId,
  serviceId,
  startsAt,
  notes = null,
}) {
  const response = await fetch(
    '/api/appointments',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        salon_id: salonId,
        client_id: clientId,
        employee_id: employeeId,
        service_id: serviceId,
        starts_at: startsAt,
        notes,
      }),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to create appointment.'
    )

    error.code =
      responseBody?.error?.code ||
      'APPOINTMENT_CREATE_FAILED'

    throw error
  }

  return responseBody.data
}