import {
    getCalendarContext,
} from '../services/calendarService.js'

const ALLOWED_APPOINTMENT_STATUSES = [
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
]

function isValidDateKey(dateKey) {
    if (
        typeof dateKey !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ) {
        return false
    }

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
            day
        )
    )

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}

function dateKeyToUtcMilliseconds(dateKey) {
    const [
        year,
        month,
        day,
    ] = dateKey
        .split('-')
        .map(Number)

    return Date.UTC(
        year,
        month - 1,
        day
    )
}

export async function getCalendar(
    req,
    res,
    next
) {
    try {
        const {
            salonId,
            from,
            to,
            employeeId,
            status,
        } = req.query

        const numericSalonId =
            Number(salonId)

        if (
            !Number.isSafeInteger(
                numericSalonId
            ) ||
            numericSalonId <= 0
        ) {
            return res
                .status(400)
                .json({
                    error: {
                        code:
                            'INVALID_SALON_ID',
                        message:
                            'salonId must be a positive integer.',
                    },
                })
        }

        if (!isValidDateKey(from)) {
            return res
                .status(400)
                .json({
                    error: {
                        code:
                            'INVALID_CALENDAR_FROM',
                        message:
                            'from must be a valid date in YYYY-MM-DD format.',
                    },
                })
        }

        if (!isValidDateKey(to)) {
            return res
                .status(400)
                .json({
                    error: {
                        code:
                            'INVALID_CALENDAR_TO',
                        message:
                            'to must be a valid date in YYYY-MM-DD format.',
                    },
                })
        }

        const fromMilliseconds =
            dateKeyToUtcMilliseconds(
                from
            )

        const toMilliseconds =
            dateKeyToUtcMilliseconds(
                to
            )

        if (
            fromMilliseconds >
            toMilliseconds
        ) {
            return res
                .status(400)
                .json({
                    error: {
                        code:
                            'INVALID_CALENDAR_RANGE',
                        message:
                            'from must be on or before to.',
                    },
                })
        }

        const rangeDays =
            Math.floor(
                (
                    toMilliseconds -
                    fromMilliseconds
                ) /
                (
                    24 *
                    60 *
                    60 *
                    1000
                )
            ) + 1

        if (rangeDays > 62) {
            return res
                .status(400)
                .json({
                    error: {
                        code:
                            'CALENDAR_RANGE_TOO_LARGE',
                        message:
                            'Calendar range cannot exceed 62 days.',
                    },
                })
        }

        let numericEmployeeId =
            null

        if (
            employeeId !== undefined
        ) {
            numericEmployeeId =
                Number(employeeId)

            if (
                !Number.isSafeInteger(
                    numericEmployeeId
                ) ||
                numericEmployeeId <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        error: {
                            code:
                                'INVALID_EMPLOYEE_ID',
                            message:
                                'employeeId must be a positive integer.',
                        },
                    })
            }
        }

        const normalizedStatus =
            status === undefined
                ? null
                : status

        if (
            normalizedStatus !== null &&
            !ALLOWED_APPOINTMENT_STATUSES
                .includes(
                    normalizedStatus
                )
        ) {
            return res
                .status(400)
                .json({
                    error: {
                        code:
                            'INVALID_APPOINTMENT_STATUS',
                        message:
                            'Appointment status is invalid.',
                    },
                })
        }

        const result =
            await getCalendarContext({
                salonId:
                    numericSalonId,
                from,
                to,
                employeeId:
                    numericEmployeeId,
                status:
                    normalizedStatus,
            })

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
                            result.error.message,
                    },
                })
        }

        return res
            .status(200)
            .json({
                data:
                    result.data,
            })
    } catch (error) {
        next(error)
    }
}