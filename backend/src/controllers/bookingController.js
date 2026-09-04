import {
    createBooking as createBookingService,
} from '../services/bookingService.js'

function isValidDate(date) {
    if (
        typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false
    }

    const [
        year,
        month,
        day,
    ] = date.split('-').map(Number)

    const parsedDate = new Date(
        Date.UTC(
            year,
            month - 1,
            day
        )
    )

    return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day
    )
}

function isValidStartTime(startTime) {
    if (
        typeof startTime !== 'string' ||
        !/^\d{2}:\d{2}$/.test(startTime)
    ) {
        return false
    }

    const [
        hours,
        minutes,
    ] = startTime.split(':').map(Number)

    return (
        Number.isInteger(hours) &&
        Number.isInteger(minutes) &&
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59
    )
}

export function validateBookingRequestBody(body) {
    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body)
    ) {
        return {
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                message:
                    'Request body must be a JSON object.',
            },
        }
    }

    const {
        salon_id,
        client_id,
        employee_id,
        service_id,
        date,
        start_time,
        notes,
    } = body

    const requiredIds = {
        salon_id,
        client_id,
        employee_id,
        service_id,
    }

    for (
        const [field, value]
        of Object.entries(requiredIds)
    ) {
        const numericValue =
            Number(value)

        if (
            !Number.isSafeInteger(
                numericValue
            ) ||
            numericValue <= 0
        ) {
            return {
                error: {
                    status: 400,
                    code:
                        'VALIDATION_ERROR',
                    message:
                        `${field} must be a positive integer.`,
                },
            }
        }
    }

    if (!isValidDate(date)) {
        return {
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                message:
                    'date must be a valid date in YYYY-MM-DD format.',
            },
        }
    }

    if (!isValidStartTime(start_time)) {
        return {
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                message:
                    'start_time must be a valid time in HH:mm format.',
            },
        }
    }

    if (
        notes !== undefined &&
        notes !== null &&
        (
            typeof notes !== 'string' ||
            notes.length > 1000
        )
    ) {
        return {
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                message:
                    'notes must be a string with at most 1000 characters.',
            },
        }
    }

    return {
        data: {
            salon_id:
                Number(salon_id),
            client_id:
                Number(client_id),
            employee_id:
                Number(employee_id),
            service_id:
                Number(service_id),
            date,
            start_time,
            notes:
                notes ?? null,
        },
    }
}

export async function createBooking(
    req,
    res,
    next
) {
    try {
        const validationResult =
            validateBookingRequestBody(
                req.body
            )

        if (validationResult.error) {
            return res
                .status(
                    validationResult
                        .error
                        .status
                )
                .json({
                    error: {
                        code:
                            validationResult
                                .error
                                .code,
                        message:
                            validationResult
                                .error
                                .message,
                    },
                })
        }

        const result =
            await createBookingService(
                validationResult.data
            )

        if (result.error) {
            return res
                .status(
                    result.error.status
                )
                .json({
                    error: {
                        code:
                            result.error.code,
                        message:
                            result.error
                                .message,
                    },
                })
        }

        return res
            .status(201)
            .json({
                data: result.data,
            })
    } catch (error) {
        next(error)
    }
}