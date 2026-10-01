export async function fetchClients({ salonId }) {
  const response = await fetch(
    `/api/clients?salon_id=${encodeURIComponent(salonId)}`
  )

  const responseBody = await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to load clients.'
    )

    error.code =
      responseBody?.error?.code ||
      'CLIENTS_LOAD_FAILED'

    throw error
  }

  return responseBody.data
}

export async function createClient(clientPayload) {
  const response = await fetch('/api/clients', {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(clientPayload),
  })

  const responseBody = await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to create client.'
    )

    error.code =
      responseBody?.error?.code ||
      'CLIENT_CREATE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function updateClient(
  clientId,
  clientPayload
) {
  const response = await fetch(
    `/api/clients/${clientId}`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(clientPayload),
    }
  )

  const responseBody = await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to update client.'
    )

    error.code =
      responseBody?.error?.code ||
      'CLIENT_UPDATE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function updateClientActive(
  clientId,
  salonId,
  active
) {
  const response = await fetch(
    `/api/clients/${clientId}/active`,
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

  const responseBody = await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to update client active status.'
    )

    error.code =
      responseBody?.error?.code ||
      'CLIENT_ACTIVE_UPDATE_FAILED'

    throw error
  }

  return responseBody.data
}