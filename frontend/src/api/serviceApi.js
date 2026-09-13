export async function fetchServices(
  salonId
) {
  const response = await fetch(
    `/api/services?salon_id=${salonId}`
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to load services.'
    )

    error.code =
      responseBody?.error?.code ||
      'SERVICES_LOAD_FAILED'

    throw error
  }

  return responseBody.data
}

export async function createService({
  salonId,
  name,
  category,
  priceCents,
  defaultDurationMinutes,
}) {
  const response = await fetch(
    '/api/services',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        salon_id: salonId,
        name,
        category,
        price_cents: priceCents,
        default_duration_minutes:
          defaultDurationMinutes,
      }),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to create service.'
    )

    error.code =
      responseBody?.error?.code ||
      'SERVICE_CREATE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function updateService({
  serviceId,
  salonId,
  name,
  category,
  priceCents,
  defaultDurationMinutes,
}) {
  const response = await fetch(
    `/api/services/${serviceId}`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        salon_id: salonId,
        name,
        category,
        price_cents: priceCents,
        default_duration_minutes:
          defaultDurationMinutes,
      }),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to update service.'
    )

    error.code =
      responseBody?.error?.code ||
      'SERVICE_UPDATE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function updateServiceActive({
  serviceId,
  salonId,
  active,
}) {
  const response = await fetch(
    `/api/services/${serviceId}/active`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        salon_id: salonId,
        active,
      }),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to update service status.'
    )

    error.code =
      responseBody?.error?.code ||
      'SERVICE_ACTIVE_UPDATE_FAILED'

    throw error
  }

  return responseBody.data
}