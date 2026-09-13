export async function fetchEmployees({
  salonId,
}) {
  const response = await fetch(
    `/api/employees?salon_id=${salonId}`
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to load employees.'
    )

    error.code =
      responseBody?.error?.code ||
      'EMPLOYEES_LOAD_FAILED'

    throw error
  }

  return responseBody.data
}