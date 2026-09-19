import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'
import pool from '../src/database/pool.js'

after(async () => {
    await pool.end()
})

test(
    'GET /api/calendar returns seeded appointment for valid day range',
    async () => {
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

            const response =
                await fetch(
                    `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-05&to=2026-10-05`
                )

            const body =
                await response.json()

            assert.equal(
                response.status,
                200
            )

            assert.equal(
                body.data.salon.id,
                1
            )

            assert.equal(
                body.data.salon.timezone,
                'Europe/Zagreb'
            )

            assert.equal(
                body.data.from,
                '2026-10-05'
            )

            assert.equal(
                body.data.to,
                '2026-10-05'
            )

            assert.equal(
                body.data.appointments.length,
                1
            )

            const appointment =
                body.data.appointments[0]

            assert.equal(
                appointment.id,
                1
            )

            assert.equal(
                appointment.starts_at,
                '2026-10-05T08:00:00.000Z'
            )

            assert.equal(
                appointment.ends_at,
                '2026-10-05T08:30:00.000Z'
            )

            assert.equal(
                appointment.status,
                'confirmed'
            )

            assert.deepEqual(
                appointment.client,
                {
                    id: 1,
                    name: 'Demo Client',
                }
            )

            assert.deepEqual(
                appointment.employee,
                {
                    id: 1,
                    name: 'Demo Employee',
                }
            )

            assert.equal(
                appointment.service.id,
                1
            )

            assert.equal(
                appointment.service.name,
                'Demo Service'
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
    'GET /api/calendar returns empty appointments for range without appointments',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-06&to=2026-10-06`
            )

            const body = await response.json()

            assert.equal(response.status, 200)
            assert.deepEqual(body.data.appointments, [])
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar filters by employeeId',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-05&to=2026-10-05&employeeId=1`
            )

            const body = await response.json()

            assert.equal(response.status, 200)
            assert.equal(body.data.appointments.length, 1)
            assert.equal(
                body.data.appointments[0].employee.id,
                1
            )
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar filters by status',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-05&to=2026-10-05&status=confirmed`
            )

            const body = await response.json()

            assert.equal(response.status, 200)
            assert.equal(body.data.appointments.length, 1)
            assert.equal(
                body.data.appointments[0].status,
                'confirmed'
            )
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar returns empty appointments for unmatched employee filter',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-05&to=2026-10-05&employeeId=999`
            )

            const body = await response.json()

            assert.equal(response.status, 200)
            assert.deepEqual(body.data.appointments, [])
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar rejects invalid salonId',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=0&from=2026-10-05&to=2026-10-05`
            )

            const body = await response.json()

            assert.equal(response.status, 400)

            assert.deepEqual(body, {
                error: {
                    code: 'INVALID_SALON_ID',
                    message:
                        'salonId must be a positive integer.',
                },
            })
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar rejects invalid from date',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-02-31&to=2026-10-05`
            )

            const body = await response.json()

            assert.equal(response.status, 400)

            assert.deepEqual(body, {
                error: {
                    code:
                        'INVALID_CALENDAR_FROM',
                    message:
                        'from must be a valid date in YYYY-MM-DD format.',
                },
            })
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar rejects invalid to date',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-05&to=2026-02-31`
            )

            const body = await response.json()

            assert.equal(response.status, 400)

            assert.deepEqual(body, {
                error: {
                    code:
                        'INVALID_CALENDAR_TO',
                    message:
                        'to must be a valid date in YYYY-MM-DD format.',
                },
            })
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar rejects reversed date range',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-06&to=2026-10-05`
            )

            const body = await response.json()

            assert.equal(response.status, 400)

            assert.deepEqual(body, {
                error: {
                    code:
                        'INVALID_CALENDAR_RANGE',
                    message:
                        'from must be on or before to.',
                },
            })
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar rejects range larger than 62 days',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-01-01&to=2026-03-10`
            )

            const body = await response.json()

            assert.equal(response.status, 400)

            assert.deepEqual(body, {
                error: {
                    code:
                        'CALENDAR_RANGE_TOO_LARGE',
                    message:
                        'Calendar range cannot exceed 62 days.',
                },
            })
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar rejects invalid appointment status',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2026-10-05&to=2026-10-05&status=banana`
            )

            const body = await response.json()

            assert.equal(response.status, 400)

            assert.deepEqual(body, {
                error: {
                    code:
                        'INVALID_APPOINTMENT_STATUS',
                    message:
                        'Appointment status is invalid.',
                },
            })
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar returns 404 for missing salon',
    async () => {
        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=999999&from=2026-10-05&to=2026-10-05`
            )

            const body = await response.json()

            assert.equal(response.status, 404)

            assert.deepEqual(body, {
                error: {
                    code: 'SALON_NOT_FOUND',
                    message: 'Salon was not found.',
                },
            })
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar respects salon timezone across daylight saving time',
    async () => {
        const clientResult =
            await pool.query(
                `
                    SELECT id
                    FROM clients
                    WHERE salon_id = 1
                    ORDER BY id
                    LIMIT 1
                `
            )

        const employeeResult =
            await pool.query(
                `
                    SELECT id
                    FROM employees
                    WHERE salon_id = 1
                    ORDER BY id
                    LIMIT 1
                `
            )

        const serviceResult =
            await pool.query(
                `
                    SELECT
                        id,
                        price_cents,
                        default_duration_minutes
                    FROM services
                    WHERE salon_id = 1
                    ORDER BY id
                    LIMIT 1
                `
            )

        assert.ok(clientResult.rows[0])
        assert.ok(employeeResult.rows[0])
        assert.ok(serviceResult.rows[0])

        const clientId =
            clientResult.rows[0].id

        const employeeId =
            employeeResult.rows[0].id

        const service =
            serviceResult.rows[0]

        const insertedAppointmentResult =
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
                        1,
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        'confirmed',
                        'manual',
                        'Calendar DST boundary test'
                    )
                    RETURNING id
                `,
                [
                    clientId,
                    employeeId,
                    service.id,
                    '2030-07-09T22:30:00.000Z',
                    '2030-07-09T23:00:00.000Z',
                    service.price_cents,
                    service.default_duration_minutes,
                ]
            )

        const appointmentId =
            insertedAppointmentResult.rows[0].id

        const server = app.listen(0)

        try {
            await new Promise((resolve) => {
                server.once('listening', resolve)
            })

            const address = server.address()

            const response = await fetch(
                `http://127.0.0.1:${address.port}/api/calendar?salonId=1&from=2030-07-10&to=2030-07-10`
            )

            const body = await response.json()

            assert.equal(response.status, 200)

            const matchingAppointment =
                body.data.appointments.find(
                    (appointment) =>
                        appointment.id ===
                        Number(appointmentId)
                )

            assert.ok(matchingAppointment)

            assert.equal(
                matchingAppointment.starts_at,
                '2030-07-09T22:30:00.000Z'
            )

            assert.equal(
                matchingAppointment.ends_at,
                '2030-07-09T23:00:00.000Z'
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM appointments
                    WHERE id = $1
                `,
                [
                    appointmentId,
                ]
            )

            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }

                    resolve()
                })
            })
        }
    }
)

test(
    'GET /api/calendar preserves existing appointments after employee deactivation',
    async () => {
        const fixtureResult =
            await pool.query(
                `
                    SELECT
                        a.id AS appointment_id,
                        a.salon_id,
                        a.employee_id,
                        e.active AS employee_active
                    FROM appointments a
                    JOIN employees e
                        ON e.id = a.employee_id
                       AND e.salon_id = a.salon_id
                    JOIN salons s
                        ON s.id = a.salon_id
                    WHERE a.notes =
                        'SalonAI development seed appointment'
                      AND s.name =
                        'SalonAI Demo Salon'
                      AND e.name =
                        'Demo Employee'
                    ORDER BY a.id
                    LIMIT 1
                `
            )

        const fixture =
            fixtureResult.rows[0]

        assert.ok(
            fixture,
            'Expected seeded appointment to exist.'
        )

        assert.equal(
            fixture.employee_active,
            true,
            'Seed employee must be active before this test.'
        )

        const originalActive =
            fixture.employee_active

        const server =
            app.listen(0)

        try {
            await new Promise(
                (resolve) => {
                    if (server.listening) {
                        resolve()
                        return
                    }

                    server.once(
                        'listening',
                        resolve
                    )
                }
            )

            const address =
                server.address()

            const baseUrl =
                `http://127.0.0.1:${address.port}`

            const calendarUrl =
                `${baseUrl}/api/calendar` +
                `?salonId=${fixture.salon_id}` +
                '&from=2026-10-05' +
                '&to=2026-10-05'

            // 1. Read the existing appointment
            // before deactivating the employee.

            const beforeResponse =
                await fetch(calendarUrl)

            const beforeBody =
                await beforeResponse.json()

            assert.equal(
                beforeResponse.status,
                200
            )

            const originalAppointment =
                beforeBody.data.appointments.find(
                    (appointment) =>
                        Number(appointment.id) ===
                        Number(fixture.appointment_id)
                )

            assert.ok(
                originalAppointment,
                'Seed appointment must be visible before deactivation.'
            )

            // 2. Deactivate the employee.

            await pool.query(
                `
                    UPDATE employees
                    SET active = false
                    WHERE id = $1
                      AND salon_id = $2
                `,
                [
                    fixture.employee_id,
                    fixture.salon_id,
                ]
            )

            // 3. The appointment must remain
            // visible in the unfiltered calendar.

            const afterResponse =
                await fetch(calendarUrl)

            const afterBody =
                await afterResponse.json()

            assert.equal(
                afterResponse.status,
                200
            )

            const appointmentAfter =
                afterBody.data.appointments.find(
                    (appointment) =>
                        Number(appointment.id) ===
                        Number(fixture.appointment_id)
                )

            assert.ok(
                appointmentAfter,
                'Existing appointment must remain visible after deactivation.'
            )

            assert.deepEqual(
                appointmentAfter,
                originalAppointment,
                'Deactivation must not change existing appointment data.'
            )

            // 4. Filtering by the inactive
            // employee must still show the appointment.

            const filteredUrl =
                calendarUrl +
                `&employeeId=${fixture.employee_id}`

            const filteredResponse =
                await fetch(filteredUrl)

            const filteredBody =
                await filteredResponse.json()

            assert.equal(
                filteredResponse.status,
                200
            )

            const filteredAppointment =
                filteredBody.data.appointments.find(
                    (appointment) =>
                        Number(appointment.id) ===
                        Number(fixture.appointment_id)
                )

            assert.ok(
                filteredAppointment,
                'Inactive employee appointment must remain visible when filtered by employeeId.'
            )

            assert.deepEqual(
                filteredAppointment,
                originalAppointment,
                'Employee filtering must preserve existing appointment data.'
            )
        } finally {
            try {
                // Restore the original employee state
                // even if an assertion fails.

                await pool.query(
                    `
                        UPDATE employees
                        SET active = $3
                        WHERE id = $1
                          AND salon_id = $2
                    `,
                    [
                        fixture.employee_id,
                        fixture.salon_id,
                        originalActive,
                    ]
                )
            } finally {
                await new Promise(
                    (resolve, reject) => {
                        server.close(
                            (error) => {
                                if (error) {
                                    reject(error)
                                    return
                                }

                                resolve()
                            }
                        )
                    }
                )
            }
        }
    }
)