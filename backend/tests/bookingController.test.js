import test from 'node:test'
import assert from 'node:assert/strict'

import {
    validateBookingRequestBody,
} from '../src/controllers/bookingController.js'

test(
    'validateBookingRequestBody accepts valid booking payload',
    () => {
        const result =
            validateBookingRequestBody({
                salon_id: 3,
                client_id: 4,
                employee_id: 3,
                service_id: 5,
                date: '2030-01-09',
                start_time: '10:30',
                notes: 'Booking test',
            })

        assert.deepEqual(
            result,
            {
                data: {
                    salon_id: 3,
                    client_id: 4,
                    employee_id: 3,
                    service_id: 5,
                    date: '2030-01-09',
                    start_time: '10:30',
                    notes: 'Booking test',
                },
            }
        )
    }
)

test(
    'validateBookingRequestBody rejects invalid ID',
    () => {
        const result =
            validateBookingRequestBody({
                salon_id: 0,
                client_id: 4,
                employee_id: 3,
                service_id: 5,
                date: '2030-01-09',
                start_time: '10:30',
            })

        assert.deepEqual(
            result,
            {
                error: {
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    message:
                        'salon_id must be a positive integer.',
                },
            }
        )
    }
)

test(
    'validateBookingRequestBody rejects invalid calendar date',
    () => {
        const result =
            validateBookingRequestBody({
                salon_id: 3,
                client_id: 4,
                employee_id: 3,
                service_id: 5,
                date: '2030-02-31',
                start_time: '10:30',
            })

        assert.deepEqual(
            result,
            {
                error: {
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    message:
                        'date must be a valid date in YYYY-MM-DD format.',
                },
            }
        )
    }
)

test(
    'validateBookingRequestBody rejects invalid start_time',
    () => {
        const result =
            validateBookingRequestBody({
                salon_id: 3,
                client_id: 4,
                employee_id: 3,
                service_id: 5,
                date: '2030-01-09',
                start_time: '24:00',
            })

        assert.deepEqual(
            result,
            {
                error: {
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    message:
                        'start_time must be a valid time in HH:mm format.',
                },
            }
        )
    }
)

test(
    'validateBookingRequestBody rejects notes longer than 1000 characters',
    () => {
        const result =
            validateBookingRequestBody({
                salon_id: 3,
                client_id: 4,
                employee_id: 3,
                service_id: 5,
                date: '2030-01-09',
                start_time: '10:30',
                notes: 'a'.repeat(1001),
            })

        assert.deepEqual(
            result,
            {
                error: {
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    message:
                        'notes must be a string with at most 1000 characters.',
                },
            }
        )
    }
)

test(
    'validateBookingRequestBody normalizes string IDs to numbers',
    () => {
        const result =
            validateBookingRequestBody({
                salon_id: '3',
                client_id: '4',
                employee_id: '3',
                service_id: '5',
                date: '2030-01-09',
                start_time: '10:30',
                notes: null,
            })

        assert.deepEqual(
            result,
            {
                data: {
                    salon_id: 3,
                    client_id: 4,
                    employee_id: 3,
                    service_id: 5,
                    date: '2030-01-09',
                    start_time: '10:30',
                    notes: null,
                },
            }
        )
    }
)