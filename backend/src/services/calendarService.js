import {
    findSalonById,
} from '../repositories/appointmentRepository.js'

import {
    findCalendarAppointments,
} from '../repositories/calendarRepository.js'

import {
    zonedDateTimeToUtc,
} from '../utils/timezone.js'

function addDaysToDateKey(
    dateKey,
    daysToAdd
) {
    const [
        year,
        month,
        day,
    ] = dateKey
        .split('-')
        .map(Number)

    const date = new Date(
        Date.UTC(
            year,
            month - 1,
            day + daysToAdd
        )
    )

    const resultYear =
        date.getUTCFullYear()

    const resultMonth =
        String(
            date.getUTCMonth() + 1
        ).padStart(2, '0')

    const resultDay =
        String(
            date.getUTCDate()
        ).padStart(2, '0')

    return (
        `${resultYear}-${resultMonth}-${resultDay}`
    )
}

function mapCalendarAppointment(row) {
    return {
        id: Number(row.id),

        salon_id:
            Number(row.salon_id),

        starts_at:
            new Date(
                row.starts_at
            ).toISOString(),

        ends_at:
            new Date(
                row.ends_at
            ).toISOString(),

        duration_minutes:
            Number(
                row.duration_minutes
            ),

        price_cents:
            Number(
                row.price_cents
            ),

        status:
            row.status,

        source:
            row.source,

        notes:
            row.notes,

        client: {
            id:
                Number(
                    row.client_id
                ),

            name:
                row.client_name,
        },

        employee: {
            id:
                Number(
                    row.employee_id
                ),

            name:
                row.employee_name,
        },

        service: {
            id:
                Number(
                    row.service_id
                ),

            name:
                row.service_name,

            category:
                row.service_category,

            default_duration_minutes:
                Number(
                    row
                        .service_default_duration_minutes
                ),
        },
    }
}

export async function getCalendarContext({
    salonId,
    from,
    to,
    employeeId = null,
    status = null,
}) {
    const salon =
        await findSalonById(
            salonId
        )

    if (!salon) {
        return {
            error: {
                status: 404,
                code:
                    'SALON_NOT_FOUND',
                message:
                    'Salon was not found.',
            },
        }
    }

    if (!salon.active) {
        return {
            error: {
                status: 400,
                code:
                    'SALON_INACTIVE',
                message:
                    'Salon is not active.',
            },
        }
    }

    const rangeStart =
        zonedDateTimeToUtc({
            date: from,
            time: '00:00:00',
            timeZone:
                salon.timezone,
        })

    const dayAfterTo =
        addDaysToDateKey(
            to,
            1
        )

    const rangeEnd =
        zonedDateTimeToUtc({
            date:
                dayAfterTo,
            time: '00:00:00',
            timeZone:
                salon.timezone,
        })

    const rows =
        await findCalendarAppointments({
            salonId,
            rangeStart,
            rangeEnd,
            employeeId,
            status,
        })

    return {
        data: {
            salon: {
                id:
                    Number(
                        salon.id
                    ),

                name:
                    salon.name,

                timezone:
                    salon.timezone,
            },

            from,
            to,

            appointments:
                rows.map(
                    mapCalendarAppointment
                ),
        },
    }
}