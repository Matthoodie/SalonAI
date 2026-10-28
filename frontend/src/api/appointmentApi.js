import { serviceIds as validateServiceIds } from './appointmentItemsView.js'
import { salonFetch } from './salonApiContext.js'
export async function updateAppointmentStatus(
  appointmentId,
  status
) {
  const response = await salonFetch(
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
  const response = await salonFetch(
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

export async function changeAppointmentClient(
  appointmentId,
  clientId
) {
  const response = await salonFetch(
    `/api/appointments/${appointmentId}/client`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        client_id: clientId,
      }),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to change appointment client.'
    )

    error.code =
      responseBody?.error?.code ||
      'APPOINTMENT_CLIENT_CHANGE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function createAppointment({
  clientId,
  newClient,
  employeeId,
  serviceId,
  serviceIds,
  startsAt,
  notes = null,
}) {
  const response = await salonFetch(
    '/api/appointments',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(newClient
          ? { new_client: newClient }
          : { client_id: clientId }),
        employee_id: employeeId,
        ...(serviceIds !== undefined
          ? { service_ids: validateServiceIds(serviceIds) }
          : { service_id: serviceId }),
        starts_at: startsAt,
        notes,
      }),
    }
  )

  const responseBody = await response.json()

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

export async function fetchAppointments() {
  const response = await salonFetch(
    '/api/appointments'
  )

  const responseBody = await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to fetch appointments.'
    )

    error.code =
      responseBody?.error?.code ||
      'APPOINTMENTS_FETCH_FAILED'

    throw error
  }

  return responseBody.data
}
