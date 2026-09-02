import {
    findEmployeeAppointmentsForRange,
    findEmployeeBlockedTimesForRange,
    findEmployeeServiceQualification,
} from '../repositories/availabilityRepository.js'

import {
    findEmployeeById,
    findEmployeeDateOverride,
    findEmployeeTimeOff,
    findEmployeeWorkingHours,
    findSalonById,
    findServiceById,
} from '../repositories/appointmentRepository.js'

function getTimeZoneOffsetMilliseconds(
    date,
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
            second: '2-digit',
            hourCycle: 'h23',
        }
    )

    const parts = Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter(
                (part) =>
                    part.type !== 'literal'
            )
            .map((part) => [
                part.type,
                part.value,
            ])
    )

    const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    )

    return asUtc - date.getTime()
}

function zonedDateTimeToUtc({
    date,
    time,
    timeZone,
}) {
    const [
        year,
        month,
        day,
    ] = date.split('-').map(Number)

    const [
        hour,
        minute,
        second = 0,
    ] = time.split(':').map(Number)

    const utcGuess = new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            second
        )
    )

    const firstOffset =
        getTimeZoneOffsetMilliseconds(
            utcGuess,
            timeZone
        )

    let result = new Date(
        utcGuess.getTime() - firstOffset
    )

    const secondOffset =
        getTimeZoneOffsetMilliseconds(
            result,
            timeZone
        )

    if (secondOffset !== firstOffset) {
        result = new Date(
            utcGuess.getTime() -
            secondOffset
        )
    }

    return result
}

function getSalonDayRange(
    date,
    timeZone
) {
    const rangeStart =
        zonedDateTimeToUtc({
            date,
            time: '00:00:00',
            timeZone,
        })

    const [
        year,
        month,
        day,
    ] = date.split('-').map(Number)

    const nextDate = new Date(
        Date.UTC(
            year,
            month - 1,
            day + 1
        )
    )
        .toISOString()
        .slice(0, 10)

    const rangeEnd =
        zonedDateTimeToUtc({
            date: nextDate,
            time: '00:00:00',
            timeZone,
        })

    return {
        rangeStart,
        rangeEnd,
    }
}

function getDayOfWeek(date) {
    const [
        year,
        month,
        day,
    ] = date.split('-').map(Number)

    const utcDate = new Date(
        Date.UTC(
            year,
            month - 1,
            day
        )
    )

    const dayOfWeek =
        utcDate.getUTCDay()

    return dayOfWeek === 0
        ? 7
        : dayOfWeek
}


function resolveEffectiveWorkingWindow({
    workingHours,
    dateOverride,
    timeOff,
}) {
    if (timeOff) {
        return {
            available: false,
            reason: 'TIME_OFF',
            startTime: null,
            endTime: null,
        }
    }

    if (dateOverride) {
        if (!dateOverride.enabled) {
            return {
                available: false,
                reason: 'DAY_OFF',
                startTime: null,
                endTime: null,
            }
        }

        return {
            available: true,
            reason: null,
            startTime: dateOverride.start_time,
            endTime: dateOverride.end_time,
        }
    }

    if (!workingHours) {
        return {
            available: false,
            reason: 'DAY_OFF',
            startTime: null,
            endTime: null,
        }
    }

    return {
        available: true,
        reason: null,
        startTime: workingHours.start_time,
        endTime: workingHours.end_time,
    }
}

function timeToMinutes(time) {
    if (typeof time !== 'string') {
        return null
    }

    const [
        hours,
        minutes,
    ] = time.split(':').map(Number)

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null
    }

    return hours * 60 + minutes
}

function minutesToTime(totalMinutes) {
    const hours =
        Math.floor(totalMinutes / 60)

    const minutes =
        totalMinutes % 60

    return (
        `${String(hours).padStart(2, '0')}:` +
        `${String(minutes).padStart(2, '0')}`
    )
}

function generateCandidateSlots({
    startTime,
    endTime,
    durationMinutes,
    slotIntervalMinutes = 30,
}) {
    const startMinutes =
        timeToMinutes(startTime)

    const endMinutes =
        timeToMinutes(endTime)

    const normalizedDuration =
        Number(durationMinutes)

    const normalizedInterval =
        Number(slotIntervalMinutes)

    if (
        startMinutes === null ||
        endMinutes === null ||
        !Number.isFinite(normalizedDuration) ||
        normalizedDuration <= 0 ||
        !Number.isFinite(normalizedInterval) ||
        normalizedInterval <= 0
    ) {
        return []
    }

    const slots = []

    for (
        let candidateStart = startMinutes;
        candidateStart + normalizedDuration <= endMinutes;
        candidateStart += normalizedInterval
    ) {
        slots.push(
            minutesToTime(candidateStart)
        )
    }

    return slots
}

function hasBlockedTimeCollision({
    date,
    startTime,
    durationMinutes,
    blockedTimes,
    timeZone,
}) {
    if (!Array.isArray(blockedTimes)) {
        return false
    }

    const candidateStart =
        zonedDateTimeToUtc({
            date,
            time: `${startTime}:00`,
            timeZone,
        })

    const candidateEnd =
        new Date(
            candidateStart.getTime() +
            Number(durationMinutes) * 60 * 1000
        )

    return blockedTimes.some((blockedTime) => {
        const blockedStart =
            new Date(blockedTime.starts_at)

        const blockedEnd =
            new Date(blockedTime.ends_at)

        return (
            candidateStart < blockedEnd &&
            candidateEnd > blockedStart
        )
    })
}

function hasAppointmentCollision({
    date,
    startTime,
    durationMinutes,
    appointments,
    timeZone,
}) {
    if (!Array.isArray(appointments)) {
        return false
    }

    const candidateStart =
        zonedDateTimeToUtc({
            date,
            time: `${startTime}:00`,
            timeZone,
        })

    const candidateEnd =
        new Date(
            candidateStart.getTime() +
            Number(durationMinutes) * 60 * 1000
        )

    return appointments.some((appointment) => {
        const appointmentStart =
            new Date(appointment.starts_at)

        const appointmentEnd =
            new Date(appointment.ends_at)

        return (
            candidateStart < appointmentEnd &&
            candidateEnd > appointmentStart
        )
    })
}

export async function getAvailabilityDayContext({
    employeeId,
    serviceId,
    date,
}) {
    const employee =
        await findEmployeeById(employeeId)

    if (!employee) {
        return {
            error: {
                status: 404,
                code: 'EMPLOYEE_NOT_FOUND',
                message:
                    'Employee was not found.',
            },
        }
    }

    if (!employee.active) {
        return {
            error: {
                status: 400,
                code: 'EMPLOYEE_INACTIVE',
                message:
                    'Employee is not active.',
            },
        }
    }

    const service =
        await findServiceById(serviceId)

    if (!service) {
        return {
            error: {
                status: 404,
                code: 'SERVICE_NOT_FOUND',
                message:
                    'Service was not found.',
            },
        }
    }

    if (!service.active) {
        return {
            error: {
                status: 400,
                code: 'SERVICE_INACTIVE',
                message:
                    'Service is not active.',
            },
        }
    }

    if (
        Number(service.salon_id) !==
        Number(employee.salon_id)
    ) {
        return {
            error: {
                status: 400,
                code: 'SERVICE_EMPLOYEE_SALON_MISMATCH',
                message:
                    'Service and employee do not belong to the same salon.',
            },
        }
    }

    const qualification =
        await findEmployeeServiceQualification(
            employeeId,
            serviceId,
            employee.salon_id
        )

    if (!qualification) {
        return {
            error: {
                status: 400,
                code: 'EMPLOYEE_NOT_QUALIFIED',
                message:
                    'Employee is not qualified for the selected service.',
            },
        }
    }

    const salon =
        await findSalonById(employee.salon_id)

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

    const dayOfWeek =
        getDayOfWeek(date)

    const {
        rangeStart,
        rangeEnd,
    } = getSalonDayRange(
        date,
        salon.timezone
    )

    const [
        workingHours,
        dateOverride,
        timeOff,
        blockedTimes,
        appointments,
    ] = await Promise.all([
        findEmployeeWorkingHours(
            employeeId,
            dayOfWeek
        ),
        findEmployeeDateOverride(
            employeeId,
            date
        ),
        findEmployeeTimeOff(
            employeeId,
            date
        ),
        findEmployeeBlockedTimesForRange(
            employeeId,
            rangeStart,
            rangeEnd
        ),
        findEmployeeAppointmentsForRange(
            employeeId,
            rangeStart,
            rangeEnd
        ),
    ])

    const effectiveWorkingWindow =
        resolveEffectiveWorkingWindow({
            workingHours,
            dateOverride,
            timeOff,
        })
    const candidateSlots =
        effectiveWorkingWindow.available
            ? generateCandidateSlots({
                startTime:
                    effectiveWorkingWindow.startTime,
                endTime:
                    effectiveWorkingWindow.endTime,
                durationMinutes:
                    service.default_duration_minutes,
            })
            : []
    const slotsWithoutBlockedTime =
        candidateSlots.filter((startTime) => {
            return !hasBlockedTimeCollision({
                date,
                startTime,
                durationMinutes:
                    service.default_duration_minutes,
                blockedTimes,
                timeZone:
                    salon.timezone,
            })
        })

    const availableSlots =
        slotsWithoutBlockedTime.filter(
        (startTime) => {
            return !hasAppointmentCollision({
                date,
                startTime,
                durationMinutes:
                    service.default_duration_minutes,
                appointments,
                timeZone:
                    salon.timezone,
            })
        }
    )

    return {
        data: {
            employee,
            service,
            salon,
            date,
            dayOfWeek,
            rangeStart,
            rangeEnd,
            workingHours,
            dateOverride,
            timeOff,
            effectiveWorkingWindow,
            candidateSlots,
            slotsWithoutBlockedTime,
            availableSlots,
            blockedTimes,
            appointments,
        },
    }
}