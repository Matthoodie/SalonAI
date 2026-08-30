export function mapDatabaseError(error) {
  switch (error.constraint) {
    case 'appointments_client_same_salon_fkey':
      return {
        status: 400,
        code: 'CLIENT_SALON_MISMATCH',
        message:
          'Client does not belong to the selected salon.',
      }

    case 'appointments_employee_same_salon_fkey':
      return {
        status: 400,
        code: 'EMPLOYEE_SALON_MISMATCH',
        message:
          'Employee does not belong to the selected salon.',
      }

    case 'appointments_service_same_salon_fkey':
      return {
        status: 400,
        code: 'SERVICE_SALON_MISMATCH',
        message:
          'Service does not belong to the selected salon.',
      }

    case 'appointments_employee_service_qualified_fkey':
      return {
        status: 400,
        code: 'EMPLOYEE_NOT_QUALIFIED',
        message:
          'Employee is not qualified for the selected service.',
      }

    case 'appointments_duration_matches_time_range':
      return {
        status: 500,
        code: 'APPOINTMENT_DURATION_MISMATCH',
        message:
          'Appointment duration does not match its time range.',
      }

    case 'appointments_employee_no_overlap':
      return {
        status: 409,
        code: 'APPOINTMENT_CONFLICT',
        message:
          'Employee already has an appointment during this time.',
      }

    default:
      return null
  }
}