import {
    findSalonById,
} from '../repositories/appointmentRepository.js'

import {
    prepareAppointmentCreation,
} from './appointmentService.js'

import {
    zonedDateTimeToUtc,
} from '../utils/timezone.js'

export async function createBooking({
    salon_id,
    client_id,
    employee_id,
    service_id,
    date,
    start_time,
    notes,
}) {
    const salon =
        await findSalonById(salon_id)

    if (!salon) {
        return {
            error: {
                status: 404,
                code: 'SALON_NOT_FOUND',
                message:
                    'Salon was not found.',
            },
        }
    }

    if (!salon.active) {
        return {
            error: {
                status: 400,
                code: 'SALON_INACTIVE',
                message:
                    'Salon is not active.',
            },
        }
    }

    const startsAt =
        zonedDateTimeToUtc({
            date,
            time: `${start_time}:00`,
            timeZone:
                salon.timezone,
        })

    const result =
        await prepareAppointmentCreation({
            salon_id,
            client_id,
            employee_id,
            service_id,
            starts_at:
                startsAt.toISOString(),
            notes,
        })

    return result
}