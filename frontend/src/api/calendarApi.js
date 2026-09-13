export async function fetchCalendar({
  salonId,
  from,
  to,
  employeeId = null,
  status = null,
}) {
  const params = new URLSearchParams({
    salonId: String(salonId),
    from,
    to,
  })

  if (employeeId !== null) {
    params.set(
      'employeeId',
      String(employeeId)
    )
  }

  if (status !== null) {
    params.set(
      'status',
      status
    )
  }

  const response = await fetch(
    `/api/calendar?${params.toString()}`
  )

  const body = await response.json()

  if (!response.ok) {
    const error = new Error(
      body?.error?.message ||
        'Calendar request failed.'
    )

    error.code =
      body?.error?.code ||
      'CALENDAR_REQUEST_FAILED'

    error.status = response.status

    throw error
  }

  return body.data
}