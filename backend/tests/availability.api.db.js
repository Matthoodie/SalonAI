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
            e.id AS employee_id,
            sv.id AS service_id
        FROM salons s
        JOIN employees e
            ON e.salon_id = s.id
        JOIN services sv
            ON sv.salon_id = s.id
        JOIN employee_services es
            ON es.employee_id = e.id
           AND es.service_id = sv.id
           AND es.salon_id = s.id
        WHERE s.name = 'SalonAI Demo Salon'
          AND e.name = 'Demo Employee'
          AND sv.name = 'Demo Service'
        ORDER BY
            s.id,
            e.id,
            sv.id
        LIMIT 1
    `)

    assert.ok(
        result.rows[0],
        'Expected SalonAI availability seed fixture to exist.'
    )

    return result.rows[0]
}

test(
    'GET /api/availability returns available slots for valid request',
    async () => {
        const fixture =
            await getSeedFixture()

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=${fixture.employee_id}&serviceId=${fixture.service_id}&date=2030-01-07`
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                200
            )

            assert.equal(
                Number(body.data.employeeId),
                Number(fixture.employee_id)
            )

            assert.equal(
                Number(body.data.serviceId),
                Number(fixture.service_id)
            )

            assert.equal(
                body.data.date,
                '2030-01-07'
            )

            assert.equal(
                body.data.timezone,
                'Europe/Zagreb'
            )

            assert.ok(
                Number.isFinite(
                    Number(
                        body.data.durationMinutes
                    )
                )
            )

            assert.ok(
                Array.isArray(
                    body.data.availableSlots
                )
            )

            assert.ok(
                body.data.availableSlots.length > 0
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
    'GET /api/availability rejects invalid employeeId',
    async () => {
        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=banana&serviceId=1&date=2030-01-07`
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
                            'INVALID_EMPLOYEE_ID',
                        message:
                            'employeeId must be a positive integer.',
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
    'GET /api/availability rejects invalid serviceId',
    async () => {
        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=1&serviceId=banana&date=2030-01-07`
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
                            'INVALID_SERVICE_ID',
                        message:
                            'serviceId must be a positive integer.',
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
    'GET /api/availability rejects invalid date',
    async () => {
        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=1&serviceId=1&date=09-01-2030`
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
                            'INVALID_DATE',
                        message:
                            'date must use YYYY-MM-DD format.',
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
    'GET /api/availability returns 404 for missing employee',
    async () => {
        const fixture =
            await getSeedFixture()

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=999999&serviceId=${fixture.service_id}&date=2030-01-07`
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                404
            )

            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            'EMPLOYEE_NOT_FOUND',
                        message:
                            'Employee was not found.',
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
    'GET /api/availability returns 404 for missing service',
    async () => {
        const fixture =
            await getSeedFixture()

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=${fixture.employee_id}&serviceId=999999&date=2030-01-07`
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                404
            )

            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            'SERVICE_NOT_FOUND',
                        message:
                            'Service was not found.',
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
    'GET /api/availability rejects inactive employee',
    async () => {
        const fixture =
            await getSeedFixture()

        await pool.query(
            `
                UPDATE employees
                SET active = false
                WHERE id = $1
            `,
            [
                fixture.employee_id,
            ]
        )

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=${fixture.employee_id}&serviceId=${fixture.service_id}&date=2030-01-07`
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
                            'EMPLOYEE_INACTIVE',
                        message:
                            'Employee is not active.',
                    },
                }
            )
        } finally {
            await pool.query(
                `
                    UPDATE employees
                    SET active = true
                    WHERE id = $1
                `,
                [
                    fixture.employee_id,
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
    'GET /api/availability rejects inactive service',
    async () => {
        const fixture =
            await getSeedFixture()

        await pool.query(
            `
                UPDATE services
                SET active = false
                WHERE id = $1
            `,
            [
                fixture.service_id,
            ]
        )

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=${fixture.employee_id}&serviceId=${fixture.service_id}&date=2030-01-07`
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
                            'SERVICE_INACTIVE',
                        message:
                            'Service is not active.',
                    },
                }
            )
        } finally {
            await pool.query(
                `
                    UPDATE services
                    SET active = true
                    WHERE id = $1
                `,
                [
                    fixture.service_id,
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
    'GET /api/availability rejects inactive salon',
    async () => {
        const fixture =
            await getSeedFixture()

        await pool.query(
            `
                UPDATE salons
                SET active = false
                WHERE id = $1
            `,
            [
                fixture.salon_id,
            ]
        )

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=${fixture.employee_id}&serviceId=${fixture.service_id}&date=2030-01-07`
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
                            'SALON_INACTIVE',
                        message:
                            'Salon is not active.',
                    },
                }
            )
        } finally {
            await pool.query(
                `
                    UPDATE salons
                    SET active = true
                    WHERE id = $1
                `,
                [
                    fixture.salon_id,
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
    'GET /api/availability rejects employee not qualified for selected service',
    async () => {
        const fixture =
            await getSeedFixture()

        const serviceResult =
            await pool.query(
                `
                    INSERT INTO services (
                        salon_id,
                        name,
                        category,
                        default_duration_minutes,
                        price_cents,
                        active
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6
                    )
                    RETURNING id
                `,
                [
                    fixture.salon_id,
                    'Availability API Unqualified Test Service',
                    'Test',
                    30,
                    2500,
                    true,
                ]
            )

        const serviceId =
            serviceResult.rows[0].id

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=${fixture.employee_id}&serviceId=${serviceId}&date=2030-01-07`
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
                            'EMPLOYEE_NOT_QUALIFIED',
                        message:
                            'Employee is not qualified for the selected service.',
                    },
                }
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM services
                    WHERE id = $1
                `,
                [
                    serviceId,
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
    'GET /api/availability returns empty slots for unavailable day',
    async () => {
        const fixture =
            await getSeedFixture()

        await pool.query(
            `
                INSERT INTO employee_date_overrides (
                    employee_id,
                    date,
                    enabled,
                    start_time,
                    end_time
                )
                VALUES (
                    $1,
                    $2,
                    false,
                    NULL,
                    NULL
                )
                ON CONFLICT (employee_id, date)
                DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time
            `,
            [
                fixture.employee_id,
                '2030-01-10',
            ]
        )

        const server = app.listen(0)

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
                `http://127.0.0.1:${address.port}/api/availability?employeeId=${fixture.employee_id}&serviceId=${fixture.service_id}&date=2030-01-10`
            )

            const body =
                await response.json()

            assert.equal(
                response.status,
                200
            )

            assert.equal(
                Number(body.data.employeeId),
                Number(fixture.employee_id)
            )

            assert.equal(
                Number(body.data.serviceId),
                Number(fixture.service_id)
            )

            assert.equal(
                body.data.date,
                '2030-01-10'
            )

            assert.equal(
                body.data.timezone,
                'Europe/Zagreb'
            )

            assert.ok(
                Number.isFinite(
                    Number(
                        body.data.durationMinutes
                    )
                )
            )

            assert.deepEqual(
                body.data.availableSlots,
                []
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM employee_date_overrides
                    WHERE employee_id = $1
                      AND date = $2
                `,
                [
                    fixture.employee_id,
                    '2030-01-10',
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