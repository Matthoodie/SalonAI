const dayKeyByNumber = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

function createEmptyWorkingHours() {
  return {
    monday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },

    tuesday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },

    wednesday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },

    thursday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },

    friday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },

    saturday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },

    sunday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },
  }
}

function normalizeTime(time) {
  if (!time) {
    return ''
  }

  return String(time).slice(0, 5)
}

export function mapEmployeeToFrontend(
  employee
) {
  const workingHours =
    createEmptyWorkingHours()

  for (
    const workingHour of
    employee.working_hours ?? []
  ) {
    const dayKey =
      dayKeyByNumber[
        workingHour.day_of_week
      ]

    if (!dayKey) {
      continue
    }

    workingHours[dayKey] = {
      enabled: true,
      startTime: normalizeTime(
        workingHour.start_time
      ),
      endTime: normalizeTime(
        workingHour.end_time
      ),
    }
  }

  return {
    id: Number(employee.id),

    salonId:
      Number(employee.salon_id),

    name: employee.name,

    active:
      employee.active !== false,

    serviceIds:
      (employee.service_ids ?? []).map(
        (serviceId) =>
          Number(serviceId)
      ),

    workingHours,
  }
}

export function mapEmployeesToFrontend(
  employees
) {
  return employees.map(
    mapEmployeeToFrontend
  )
}