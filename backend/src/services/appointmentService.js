import {
    findAllAppointments,
    findAppointmentById,
    findEmployeeBlockedTimeOverlap,
    findEmployeeById,
    findEmployeeDateOverride,
    findEmployeeTimeOff,
    findEmployeeWorkingHours,
    findSalonById,
    findServiceById,
    insertAppointment,
} from '../repositories/appointmentRepository.js'


function getZonedDateTimeParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            weekday: 'short',
            hourCycle: 'h23',
        }
    )

    const parts = Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [
                part.type,
                part.value,
            ])
    )

    const dayOfWeekMap = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 7,
    }

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time:
            `${parts.hour}:${parts.minute}:${parts.second}`,
        dayOfWeek:
            dayOfWeekMap[parts.weekday],
    }
}


export async function getAllAppointments() {
    return findAllAppointments()
}

export async function getAppointmentById(id) {
    return findAppointmentById(id)
}

export async function prepareAppointmentCreation({
    salon_id,
    client_id,
    employee_id,
    service_id,
    starts_at,
    notes,
}) {

    const salon = await findSalonById(salon_id)

    if (!salon) {
        return {
            error: {
                status: 404,
                code: 'SALON_NOT_FOUND',
                message: 'Salon was not found.',
            },
        }
    }

    if (!salon.active) {
        return {
            error: {
                status: 400,
                code: 'SALON_INACTIVE',
                message: 'Salon is not active.',
            },
        }
    }

    const service = await findServiceById(service_id)

    if (!service) {
        return {
            error: {
                status: 404,
                code: 'SERVICE_NOT_FOUND',
                message: 'Service was not found.',
            },
        }
    }

    if (Number(service.salon_id) !== Number(salon_id)) {
        return {
            error: {
                status: 400,
                code: 'SERVICE_SALON_MISMATCH',
                message:
                    'Service does not belong to the selected salon.',
            },
        }
    }

    if (!service.active) {
        return {
            error: {
                status: 400,
                code: 'SERVICE_INACTIVE',
                message: 'Service is not active.',
            },
        }
    }

    const employee = await findEmployeeById(employee_id)

    if (!employee) {
        return {
            error: {
                status: 404,
                code: 'EMPLOYEE_NOT_FOUND',
                message: 'Employee was not found.',
            },
        }
    }

    if (Number(employee.salon_id) !== Number(salon_id)) {
        return {
            error: {
                status: 400,
                code: 'EMPLOYEE_SALON_MISMATCH',
                message:
                    'Employee does not belong to the selected salon.',
            },
        }
    }

    if (!employee.active) {
        return {
            error: {
                status: 400,
                code: 'EMPLOYEE_INACTIVE',
                message: 'Employee is not active.',
            },
        }
    }

    const startsAt = new Date(starts_at)

    const endsAt = new Date(
        startsAt.getTime() +
        service.default_duration_minutes * 60 * 1000
    )

    const localStart = getZonedDateTimeParts(
        startsAt,
        salon.timezone
    )

    const localEnd = getZonedDateTimeParts(
        endsAt,
        salon.timezone
    )

    const dateOverride =
        await findEmployeeDateOverride(
            employee_id,
            localStart.date
        )

    if (dateOverride && !dateOverride.enabled) {
        return {
            error: {
                status: 409,
                code: 'EMPLOYEE_UNAVAILABLE',
                message:
                    'Employee is not available on the selected date.',
            },
        }
    }

    let workingStartTime
    let workingEndTime

    if (dateOverride) {
        workingStartTime = dateOverride.start_time
        workingEndTime = dateOverride.end_time
    } else {
        const workingHours =
            await findEmployeeWorkingHours(
                employee_id,
                localStart.dayOfWeek
            )

        if (!workingHours) {
            return {
                error: {
                    status: 409,
                    code: 'EMPLOYEE_NOT_WORKING',
                    message:
                        'Employee is not working on the selected day.',
                },
            }
        }

        workingStartTime = workingHours.start_time
        workingEndTime = workingHours.end_time
    }


    if (localEnd.date !== localStart.date) {
        return {
            error: {
                status: 409,
                code: 'APPOINTMENT_OUTSIDE_WORKING_HOURS',
                message:
                    'Appointment must end on the same working day.',
            },
        }
    }

    if (
        localStart.time < workingStartTime ||
        localEnd.time > workingEndTime
    ) {
        return {
            error: {
                status: 409,
                code: 'APPOINTMENT_OUTSIDE_WORKING_HOURS',
                message:
                    'Appointment is outside employee working hours.',
            },
        }
    }


        const timeOff = await findEmployeeTimeOff(
        employee_id,
        localStart.date
    )

    if (timeOff) {
        return {
            error: {
                status: 409,
                code: 'EMPLOYEE_TIME_OFF',
                message:
                    'Employee is unavailable due to time off.',
            },
        }
    }

    const blockedTime =
        await findEmployeeBlockedTimeOverlap(
            employee_id,
            startsAt,
            endsAt
        )

    if (blockedTime) {
        return {
            error: {
                status: 409,
                code: 'EMPLOYEE_BLOCKED_TIME',
                message:
                    'Employee is unavailable during the selected time.',
            },
        }
    }

    const appointmentData = {
        salon_id: Number(salon_id),
        client_id: Number(client_id),
        employee_id: Number(employee_id),
        service_id: Number(service_id),
        starts_at: startsAt,
        ends_at: endsAt,
        price_cents: service.price_cents,
        duration_minutes:
            service.default_duration_minutes,
        status: 'confirmed',
        source: 'manual',
        notes: notes ?? null,
    }

    const appointment =
        await insertAppointment(appointmentData)

    return {
        data: appointment,
    }
}
