export async function fetchCurrentAuth() {
  const response = await fetch('/api/auth/me', {
    cache: 'no-store',
  })

  const responseBody = await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Nije moguće učitati korisnički račun.'
    )

    error.code =
      responseBody?.error?.code ||
      'AUTH_CONTEXT_LOAD_FAILED'

    error.statusCode = response.status

    throw error
  }

  const data = responseBody?.data

  if (
    data?.authenticated !== true ||
    !['owner', 'admin', 'employee'].includes(
      data?.membership?.role
    ) ||
    !data?.current_salon?.id ||
    !data?.current_salon?.timezone
  ) {
    throw new Error(
      'Poslužitelj nije vratio valjan korisnički i salonski kontekst.'
    )
  }

  return data
}