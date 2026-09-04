import {
    getAvailabilityDayContext,
} from '../services/availabilityService.js'

export async function getAvailability(
    req,
    res,
    next
) {
    try {
        const employeeId =
            Number(req.query.employeeId)

        const serviceId =
            Number(req.query.serviceId)

        const { date } = req.query

        if (
            !Number.isSafeInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_EMPLOYEE_ID',
                    message:
                        'employeeId must be a positive integer.',
                },
            })
        }

        if (
            !Number.isSafeInteger(serviceId) ||
            serviceId <= 0
        ) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_SERVICE_ID',
                    message:
                        'serviceId must be a positive integer.',
                },
            })
        }

        if (
            typeof date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_DATE',
                    message:
                        'date must use YYYY-MM-DD format.',
                },
            })
        }

        const result =
            await getAvailabilityDayContext({
                employeeId,
                serviceId,
                date,
            })

        if (result.error) {
            return res
                .status(result.error.status)
                .json({
                    error: {
                        code: result.error.code,
                        message:
                            result.error.message,
                    },
                })
        }

        res.status(200).json({
            data: {
                employeeId,
                serviceId,
                date,
                timezone:
                    result.data.salon.timezone,
                durationMinutes:
                    result.data.service
                        .default_duration_minutes,
                availableSlots:
                    result.data.availableSlots,
            },
        })
    } catch (error) {
        next(error)
    }
}