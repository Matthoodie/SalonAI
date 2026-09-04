import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'
import pool from '../src/database/pool.js'

after(async () => {
    await pool.end()
})

async function getSeedFixture() {
    const result = await pool.query(`
        SELECT
            s.id AS salon_id,
            c.id AS client_id,
            e.id AS employee_id,
            sv.id AS service_id,
            sv.price_cents,
            sv.default_duration_minutes
        FROM salons s
        JOIN clients c
            ON c.salon_id = s.id
        JOIN employees e
            ON e.salon_id = s.id
        JOIN services sv
            ON sv.salon_id = s.id
        JOIN employee_services es
            ON es.employee_id = e.id
           AND es.service_id = sv.id
           AND es.salon_id = s.id
        WHERE s.name = 'SalonAI Demo Salon'
          AND c.name = 'Demo Client'
          AND e.name = 'Demo Employee'
          AND sv.name = 'Demo Service'
        ORDER BY
            s.id,
            c.id,
            e.id,
            sv.id
        LIMIT 1
    `)

    assert.ok(
        result.rows[0],
        'Expected SalonAI booking API seed fixture to exist.'
    )

    return result.rows[0]
}

test(
    'POST /api/bookings creates appointment from salon-local booking time',
    async () => {
        const fixture =
            await getSeedFixture()

        const server =
            app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once(
                    'listening',
                    resolve
                )
            })

            const address =
                server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/bookings`,
                {
                    method: 'POST',
                    headers: {
                        'content-type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        salon_id:
                            fixture.salon_id,
                        client_id:
                            fixture.client_id,
                        employee_id:
                            fixture.employee_id,
                        service_id:
                            fixture.service_id,
                        date:
                            '2030-01-09',
                        start_time:
                            '10:30',
                        notes:
                            'Booking API integration test',
                    }),
                }
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                201
            )

            assert.ok(body.data)

            const appointment =
                body.data

            try {
                assert.equal(
                    new Date(
                        appointment.starts_at
                    ).toISOString(),
                    '2030-01-09T09:30:00.000Z'
                )

                assert.equal(
                    new Date(
                        appointment.ends_at
                    ).toISOString(),
                    '2030-01-09T10:00:00.000Z'
                )

                assert.equal(
                    Number(
                        appointment.duration_minutes
                    ),
                    Number(
                        fixture.default_duration_minutes
                    )
                )

                assert.equal(
                    Number(
                        appointment.price_cents
                    ),
                    Number(
                        fixture.price_cents
                    )
                )

                assert.equal(
                    appointment.status,
                    'confirmed'
                )
            } finally {
                if (appointment?.id) {
                    await pool.query(
                        `
                            DELETE FROM appointments
                            WHERE id = $1
                        `,
                        [
                            appointment.id,
                        ]
                    )
                }
            }
        } finally {
            await new Promise(
                (resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error)
                            return
                        }

                        resolve()
                    })
                }
            )
        }
    }
)

test(
    'POST /api/bookings returns 409 for unavailable slot',
    async () => {
        const fixture =
            await getSeedFixture()

        const existingAppointmentResult =
            await pool.query(
                `
                    INSERT INTO appointments (
                        salon_id,
                        client_id,
                        employee_id,
                        service_id,
                        starts_at,
                        ends_at,
                        price_cents,
                        duration_minutes,
                        status,
                        source,
                        notes
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11
                    )
                    RETURNING id
                `,
                [
                    fixture.salon_id,
                    fixture.client_id,
                    fixture.employee_id,
                    fixture.service_id,
                    '2030-01-09T09:30:00.000Z',
                    '2030-01-09T10:00:00.000Z',
                    fixture.price_cents,
                    fixture.default_duration_minutes,
                    'confirmed',
                    'manual',
                    'Existing booking API conflict appointment',
                ]
            )

        const existingAppointmentId =
            existingAppointmentResult.rows[0].id

        const server =
            app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once(
                    'listening',
                    resolve
                )
            })

            const address =
                server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/bookings`,
                {
                    method: 'POST',
                    headers: {
                        'content-type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        salon_id:
                            fixture.salon_id,
                        client_id:
                            fixture.client_id,
                        employee_id:
                            fixture.employee_id,
                        service_id:
                            fixture.service_id,
                        date:
                            '2030-01-09',
                        start_time:
                            '10:30',
                        notes:
                            'Should conflict',
                    }),
                }
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                409
            )

            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            'APPOINTMENT_CONFLICT',
                        message:
                            'Employee already has an appointment during this time.',
                    },
                }
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM appointments
                    WHERE id = $1
                `,
                [
                    existingAppointmentId,
                ]
            )

            await new Promise(
                (resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error)
                            return
                        }

                        resolve()
                    })
                }
            )
        }
    }
)

test(
    'POST /api/bookings rejects invalid booking date',
    async () => {
        const fixture =
            await getSeedFixture()

        const server =
            app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once(
                    'listening',
                    resolve
                )
            })

            const address =
                server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/bookings`,
                {
                    method: 'POST',
                    headers: {
                        'content-type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        salon_id:
                            fixture.salon_id,
                        client_id:
                            fixture.client_id,
                        employee_id:
                            fixture.employee_id,
                        service_id:
                            fixture.service_id,
                        date:
                            '2030-02-31',
                        start_time:
                            '10:30',
                    }),
                }
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                400
            )

            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            'VALIDATION_ERROR',
                        message:
                            'date must be a valid date in YYYY-MM-DD format.',
                    },
                }
            )
        } finally {
            await new Promise(
                (resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error)
                            return
                        }

                        resolve()
                    })
                }
            )
        }
    }
)

test(
    'POST /api/bookings rejects invalid start_time',
    async () => {
        const fixture =
            await getSeedFixture()

        const server =
            app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once(
                    'listening',
                    resolve
                )
            })

            const address =
                server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/bookings`,
                {
                    method: 'POST',
                    headers: {
                        'content-type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        salon_id:
                            fixture.salon_id,
                        client_id:
                            fixture.client_id,
                        employee_id:
                            fixture.employee_id,
                        service_id:
                            fixture.service_id,
                        date:
                            '2030-01-09',
                        start_time:
                            '24:00',
                    }),
                }
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                400
            )

            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            'VALIDATION_ERROR',
                        message:
                            'start_time must be a valid time in HH:mm format.',
                    },
                }
            )
        } finally {
            await new Promise(
                (resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error)
                            return
                        }

                        resolve()
                    })
                }
            )
        }
    }
)

test(
    'POST /api/bookings rejects invalid salon_id',
    async () => {
        const fixture =
            await getSeedFixture()

        const server =
            app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once(
                    'listening',
                    resolve
                )
            })

            const address =
                server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/bookings`,
                {
                    method: 'POST',
                    headers: {
                        'content-type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        salon_id: 0,
                        client_id:
                            fixture.client_id,
                        employee_id:
                            fixture.employee_id,
                        service_id:
                            fixture.service_id,
                        date:
                            '2030-01-09',
                        start_time:
                            '10:30',
                    }),
                }
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                400
            )

            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            'VALIDATION_ERROR',
                        message:
                            'salon_id must be a positive integer.',
                    },
                }
            )
        } finally {
            await new Promise(
                (resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error)
                            return
                        }

                        resolve()
                    })
                }
            )
        }
    }
)

test(
    'booking flow removes booked slot from availability and rejects second booking',
    async () => {
        const fixture =
            await getSeedFixture()

        const server =
            app.listen(0)

        let createdAppointmentId = null

        try {
            await new Promise((resolve) => {
                server.once(
                    'listening',
                    resolve
                )
            })

            const address =
                server.address()

            const baseUrl =
                `http://127.0.0.1:${address.port}`

            const availabilityBeforeResponse =
                await fetch(
                    `${baseUrl}/api/availability?employeeId=${fixture.employee_id}&serviceId=${fixture.service_id}&date=2030-01-09`
                )

            const availabilityBefore =
                await availabilityBeforeResponse.json()

            assert.equal(
                availabilityBeforeResponse.status,
                200
            )

            assert.ok(
                availabilityBefore.data
                    .availableSlots
                    .includes('10:30')
            )

            const bookingResponse =
                await fetch(
                    `${baseUrl}/api/bookings`,
                    {
                        method: 'POST',
                        headers: {
                            'content-type':
                                'application/json',
                        },
                        body: JSON.stringify({
                            salon_id:
                                fixture.salon_id,
                            client_id:
                                fixture.client_id,
                            employee_id:
                                fixture.employee_id,
                            service_id:
                                fixture.service_id,
                            date:
                                '2030-01-09',
                            start_time:
                                '10:30',
                            notes:
                                'End-to-end booking flow test',
                        }),
                    }
                )

            const bookingBody =
                await bookingResponse.json()

            assert.equal(
                bookingResponse.status,
                201
            )

            assert.ok(bookingBody.data)

            createdAppointmentId =
                bookingBody.data.id

            const availabilityAfterResponse =
                await fetch(
                    `${baseUrl}/api/availability?employeeId=${fixture.employee_id}&serviceId=${fixture.service_id}&date=2030-01-09`
                )

            const availabilityAfter =
                await availabilityAfterResponse.json()

            assert.equal(
                availabilityAfterResponse.status,
                200
            )

            assert.ok(
                !availabilityAfter.data
                    .availableSlots
                    .includes('10:30')
            )

            const secondBookingResponse =
                await fetch(
                    `${baseUrl}/api/bookings`,
                    {
                        method: 'POST',
                        headers: {
                            'content-type':
                                'application/json',
                        },
                        body: JSON.stringify({
                            salon_id:
                                fixture.salon_id,
                            client_id:
                                fixture.client_id,
                            employee_id:
                                fixture.employee_id,
                            service_id:
                                fixture.service_id,
                            date:
                                '2030-01-09',
                            start_time:
                                '10:30',
                            notes:
                                'Second booking should fail',
                        }),
                    }
                )

            const secondBookingBody =
                await secondBookingResponse.json()

            assert.equal(
                secondBookingResponse.status,
                409
            )

            assert.deepEqual(
                secondBookingBody,
                {
                    error: {
                        code:
                            'APPOINTMENT_CONFLICT',
                        message:
                            'Employee already has an appointment during this time.',
                    },
                }
            )
        } finally {
            if (createdAppointmentId) {
                await pool.query(
                    `
                        DELETE FROM appointments
                        WHERE id = $1
                    `,
                    [
                        createdAppointmentId,
                    ]
                )
            }

            await new Promise(
                (resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error)
                            return
                        }

                        resolve()
                    })
                }
            )
        }
    }
)