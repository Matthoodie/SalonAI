import {
  getSalonLocalDateParts,
} from './salonDateTime'

import {
  salonDateTimeToUtcIso,
} from './appointmentDateTime'

const dayKeyByNumber = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
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
  employee,
  salonTimezone
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
  const dateOverrides =
    (employee.date_overrides ?? []).map(
      (override) => ({
        date:
          override.date,

        enabled:
          override.enabled,

        startTime:
          override.enabled
            ? normalizeTime(
              override.start_time
            )
            : '',

        endTime:
          override.enabled
            ? normalizeTime(
              override.end_time
            )
            : '',
      })
    )

  const timeOff =
    (employee.time_off ?? []).map(
      (item) => ({
        id:
          Number(item.id),

        startDate:
          item.start_date,

        endDate:
          item.end_date,

        type:
          String(item.type).toUpperCase(),

        note:
          item.note ?? '',
      })
    )


  const blockedTimes =
    (employee.blocked_times ?? []).map(
      (item) => {
        const start =
          getSalonLocalDateParts(
            item.starts_at,
            salonTimezone
          )

        const end =
          getSalonLocalDateParts(
            item.ends_at,
            salonTimezone
          )

        return {
          id:
            Number(item.id),

          date:
            start.date,

          startTime:
            start.time,

          endTime:
            end.time,

          type:
            item.type,

          note:
            item.reason ?? '',
        }
      }
    )

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
    dateOverrides,
    timeOff,
    blockedTimes,
  }
}

export function mapEmployeesToFrontend(
  employees,
  salonTimezone
) {
  return employees.map(
    (employee) =>
      mapEmployeeToFrontend(
        employee,
        salonTimezone
      )
  )
}

const dayNumberByKey = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

export function mapEmployeeToCreatePayload(
  employee,
  salonId,
  salonTimezone
) {
  const workingHours = Object.entries(
    employee.workingHours ?? {}
  )
    .filter(
      ([, schedule]) =>
        schedule.enabled
    )
    .map(([dayKey, schedule]) => ({
      day_of_week:
        dayNumberByKey[dayKey],

      start_time:
        schedule.startTime,

      end_time:
        schedule.endTime,
    }))

  const dateOverrides =
    (employee.dateOverrides ?? []).map(
      (override) => ({
        date:
          override.date,

        enabled:
          override.enabled,

        start_time:
          override.enabled
            ? override.startTime
            : null,

        end_time:
          override.enabled
            ? override.endTime
            : null,
      })
    )

  const timeOff =
    (employee.timeOff ?? []).map(
      (item) => ({
        start_date:
          item.startDate,

        end_date:
          item.endDate,

        type:
          String(item.type)
            .toLowerCase(),

        note:
          item.note || null,
      })
    )

  const blockedTimes =
  (employee.blockedTimes ?? []).map(
    (item) => ({
      starts_at:
        salonDateTimeToUtcIso(
          item.date,
          item.startTime,
          salonTimezone
        ),

      ends_at:
        salonDateTimeToUtcIso(
          item.date,
          item.endTime,
          salonTimezone
        ),

      type:
        item.type,

      reason:
        item.note || null,
    })
  )

  return {
    salon_id:
      salonId,

    name:
      employee.name,

    active:
      employee.active !== false,

    service_ids:
      employee.serviceIds ?? [],

    working_hours:
      workingHours,

    date_overrides:
      dateOverrides,

  time_off:
     timeOff,

  blocked_times:
     blockedTimes,
  }
}