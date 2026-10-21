export async function fetchClients() {
  const response = await fetch(
    '/api/clients'
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

export function canSearchBookingClients(query) {
  const value = query.trim()

  if (!value || value.length > 100) {
    return false
  }

  if (/^[+\d\s()-]+$/.test(value)) {
    const digits = value.replace(/\D/g, '')

    const significantDigits = digits.startsWith('00')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits

    return (
      digits.length <= 30 &&
      significantDigits.length >= 7
    )
  }

  return (value.match(/\p{L}/gu) ?? []).length >= 3
}

export async function searchBookingClients(query, { signal } = {}) {
  const response = await fetch(
    `/api/clients/search?q=${encodeURIComponent(query.trim())}`,
    {
      signal,
      cache: 'no-store',
    }
  )

  const body = await response.json()

  if (!response.ok) {
    const error = new Error(
      body?.error?.message ||
      'Pretraga klijenata trenutno nije dostupna.'
    )

    error.code =
      body?.error?.code ||
      'CLIENT_SEARCH_FAILED'

    throw error
  }

  return body.data.map((client) => ({
    id: client.id,
    name: client.name,
    phone: client.phone_hint ?? '',
  }))
}