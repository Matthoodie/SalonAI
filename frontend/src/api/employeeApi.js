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

export async function createEmployee(
  employeePayload
) {
  const response = await fetch(
    '/api/employees',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify(
        employeePayload
      ),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to create employee.'
    )

    error.code =
      responseBody?.error?.code ||
      'EMPLOYEE_CREATE_FAILED'

    throw error
  }

  return responseBody.data
}

export async function updateEmployee(
  employeeId,
  employeePayload
) {
  const response = await fetch(
    `/api/employees/${employeeId}`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify(
        employeePayload
      ),
    }
  )

  const responseBody =
    await response.json()

  if (!response.ok) {
    const error = new Error(
      responseBody?.error?.message ||
        'Failed to update employee.'
    )

    error.code =
      responseBody?.error?.code ||
      'EMPLOYEE_UPDATE_FAILED'

    throw error
  }

  return responseBody.data
}