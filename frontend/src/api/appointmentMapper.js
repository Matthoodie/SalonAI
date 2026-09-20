const STATUS_LABELS = {
  pending: 'Na čekanju',
  confirmed: 'Zakazano',
  completed: 'Završen',
  cancelled: 'Otkazano',
  no_show: 'Nije došao',
}

function getLocalDateParts(
  isoDateTime,
  timeZone
) {
  const formatter = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }
  )

  const parts = Object.fromEntries(
    formatter
      .formatToParts(
        new Date(isoDateTime)
      )
      .filter(
        (part) =>
          part.type !== 'literal'
      )
      .map(
        (part) => [
          part.type,
          part.value,
        ]
      )
  )

  return {
    date:
      `${parts.year}-${parts.month}-${parts.day}`,

    time:
      `${parts.hour}:${parts.minute}`,
  }
}

export function mapCalendarAppointmentToFrontend(
  appointment,
  timeZone
) {
  const {
    date,
    time,
  } = getLocalDateParts(
    appointment.starts_at,
    timeZone
  )

  return {
    id: appointment.id,

    date,
    time,

    startsAt:
      appointment.starts_at,

    endsAt:
      appointment.ends_at,

    durationMinutes:
      appointment.duration_minutes,

    priceCents:
      appointment.price_cents,

    clientId:
      appointment.client.id,

    clientName:
      appointment.client.name,

    employeeId:
      appointment.employee.id,

    employeeName:
      appointment.employee.name,

    serviceId:
      appointment.service.id,

    serviceName:
      appointment.service.name,

    service:
      appointment.service.name,

    serviceCategory:
      appointment.service.category,

    serviceDurationMinutes:
      appointment.service
        .default_duration_minutes,

    status:
      STATUS_LABELS[
        appointment.status
      ] || appointment.status,

    statusCode:
      appointment.status,

    source:
      appointment.source,

    notes:
      appointment.notes,
  }
}

export function mapCalendarResponseToAppointments(
  calendarData
) {
  return calendarData.appointments.map(
    (appointment) =>
      mapCalendarAppointmentToFrontend(
        appointment,
        calendarData.salon.timezone
      )
  )
}

export function mapAppointmentRowsToFrontend(
  appointments,
  salonTimezone,
  clientList,
  employeeList,
  serviceList
) {
  return appointments.map((appointment) => {
    const client = clientList.find(
      (item) =>
        String(item.id) ===
        String(appointment.client_id)
    )

    const employee = employeeList.find(
      (item) =>
        String(item.id) ===
        String(appointment.employee_id)
    )

    const service = serviceList.find(
      (item) =>
        String(item.id) ===
        String(appointment.service_id)
    )

    return mapCalendarAppointmentToFrontend(
      {
        ...appointment,

        client: {
          id: appointment.client_id,
          name: client?.name ?? 'Nepoznat klijent',
        },

        employee: {
          id: appointment.employee_id,
          name: employee?.name ?? 'Nepoznat zaposlenik',
        },

        service: {
          id: appointment.service_id,
          name: service?.name ?? 'Nepoznata usluga',
          category: service?.category ?? 'Ostalo',
          default_duration_minutes:
            service?.defaultDurationMinutes ??
            service?.default_duration_minutes ??
            appointment.duration_minutes,
        },
      },
      salonTimezone
    )
  })
}