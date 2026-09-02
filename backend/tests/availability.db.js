import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'
import {
    getAvailabilityDayContext,
} from '../src/services/availabilityService.js'

after(async () => {
    await pool.end()
})

async function getSeedFixture() {
    const result = await pool.query(`
        SELECT
            s.id AS salon_id,
            c.id AS client_id,
            e.id AS employee_id,
            sv.id AS service_id
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
        'Expected SalonAI regression seed fixture to exist.'
    )

    return result.rows[0]
}

test(
    'availability day context generates candidate slots for seeded employee',
    async () => {
        const fixture =
            await getSeedFixture()

        const result =
            await getAvailabilityDayContext({
                employeeId:
                    fixture.employee_id,
                serviceId:
                    fixture.service_id,
                date: '2030-01-07',
            })

        assert.equal(
            result.error,
            undefined
        )

        assert.ok(result.data)

        assert.equal(
            Number(result.data.employee.id),
            Number(fixture.employee_id)
        )

        assert.equal(
            Number(result.data.service.id),
            Number(fixture.service_id)
        )

        assert.equal(
            result.data.date,
            '2030-01-07'
        )

        assert.equal(
            result.data.effectiveWorkingWindow.available,
            true
        )

        assert.ok(
            Array.isArray(
                result.data.candidateSlots
            )
        )

        assert.ok(
            result.data.candidateSlots.length > 0
        )

        assert.ok(
            Array.isArray(
                result.data.availableSlots
            )
        )
    }
)

test(
    'availability candidate slots respect working hours boundaries',
    async () => {
        const fixture =
            await getSeedFixture()

        const result =
            await getAvailabilityDayContext({
                employeeId:
                    fixture.employee_id,
                serviceId:
                    fixture.service_id,
                date: '2030-01-07',
            })

        assert.equal(
            result.error,
            undefined
        )

        assert.ok(result.data)

        assert.equal(
            result.data.effectiveWorkingWindow.startTime,
            '09:00:00'
        )

        assert.equal(
            result.data.effectiveWorkingWindow.endTime,
            '17:00:00'
        )

        assert.equal(
            result.data.candidateSlots[0],
            '09:00'
        )

        assert.ok(
            !result.data.candidateSlots.includes(
                '17:00'
            )
        )

        assert.ok(
            result.data.candidateSlots.length > 0
        )
    }
)

test(
    'availability removes slots that overlap employee blocked time',
    async () => {
        const fixture =
            await getSeedFixture()

        const blockedTimeResult =
            await pool.query(
                `
                    INSERT INTO employee_blocked_times (
                        employee_id,
                        starts_at,
                        ends_at,
                        reason
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4
                    )
                    RETURNING id
                `,
                [
                    fixture.employee_id,
                    '2030-01-08T10:00:00.000Z',
                    '2030-01-08T11:00:00.000Z',
                    'Availability integration test',
                ]
            )

        const blockedTimeId =
            blockedTimeResult.rows[0].id

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-08',
                })

            assert.equal(
                result.error,
                undefined
            )

            assert.ok(result.data)

            assert.ok(
                result.data.candidateSlots.includes(
                    '11:00'
                )
            )

            assert.ok(
                !result.data.slotsWithoutBlockedTime.includes(
                    '11:00'
                )
            )

            assert.ok(
                !result.data.availableSlots.includes(
                    '11:00'
                )
            )

            assert.ok(
                result.data.slotsWithoutBlockedTime.includes(
                    '12:00'
                )
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM employee_blocked_times
                    WHERE id = $1
                `,
                [blockedTimeId]
            )
        }
    }
)

test(
    'availability removes slots that overlap existing appointment',
    async () => {
        const fixture =
            await getSeedFixture()

        const serviceResult =
            await pool.query(
                `
                    SELECT
                        price_cents,
                        default_duration_minutes
                    FROM services
                    WHERE id = $1
                    LIMIT 1
                `,
                [fixture.service_id]
            )

        assert.ok(
            serviceResult.rows[0],
            'Expected seeded service to exist.'
        )

        const service =
            serviceResult.rows[0]

        const appointmentResult =
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
                    '2030-01-09T10:00:00.000Z',
                    '2030-01-09T10:30:00.000Z',
                    service.price_cents,
                    30,
                    'confirmed',
                    'manual',
                    'Availability appointment collision test',
                ]
            )

        const appointmentId =
            appointmentResult.rows[0].id

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-09',
                })

            assert.equal(
                result.error,
                undefined
            )

            assert.ok(result.data)

            assert.ok(
                result.data.candidateSlots.includes(
                    '11:00'
                )
            )

            assert.ok(
                result.data.slotsWithoutBlockedTime.includes(
                    '11:00'
                )
            )

            assert.ok(
                !result.data.availableSlots.includes(
                    '11:00'
                )
            )

            assert.ok(
                result.data.availableSlots.includes(
                    '11:30'
                )
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM appointments
                    WHERE id = $1
                `,
                [appointmentId]
            )
        }
    }
)

test(
    'availability uses enabled date override instead of regular working hours',
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
                    $3,
                    $4,
                    $5
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
                true,
                '12:00',
                '15:00',
            ]
        )

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-10',
                })

            assert.equal(
                result.error,
                undefined
            )

            assert.ok(result.data)

            assert.ok(
                result.data.dateOverride
            )

            assert.equal(
                result.data.dateOverride.enabled,
                true
            )

            assert.equal(
                result.data.effectiveWorkingWindow.available,
                true
            )

            assert.equal(
                result.data.effectiveWorkingWindow.startTime,
                '12:00:00'
            )

            assert.equal(
                result.data.effectiveWorkingWindow.endTime,
                '15:00:00'
            )

            assert.equal(
                result.data.candidateSlots[0],
                '12:00'
            )

            assert.ok(
                !result.data.candidateSlots.includes(
                    '09:00'
                )
            )

            assert.ok(
                !result.data.candidateSlots.includes(
                    '15:00'
                )
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
        }
    }
)

test(
    'availability returns no slots when date override disables employee availability',
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
                    $3,
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
                false,
            ]
        )

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-10',
                })

            assert.equal(
                result.error,
                undefined
            )

            assert.ok(result.data)

            assert.ok(
                result.data.dateOverride
            )

            assert.equal(
                result.data.dateOverride.enabled,
                false
            )

            assert.deepEqual(
                result.data.effectiveWorkingWindow,
                {
                    available: false,
                    reason: 'DAY_OFF',
                    startTime: null,
                    endTime: null,
                }
            )

            assert.deepEqual(
                result.data.candidateSlots,
                []
            )

            assert.deepEqual(
                result.data.availableSlots,
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
        }
    }
)

test(
    'availability returns no slots when employee is on time off',
    async () => {
        const fixture =
            await getSeedFixture()

        const timeOffResult =
            await pool.query(
                `
                    INSERT INTO employee_time_off (
                        employee_id,
                        start_date,
                        end_date,
                        type,
                        note
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    RETURNING id
                `,
                [
                    fixture.employee_id,
                    '2030-01-10',
                    '2030-01-10',
                    'vacation',
                    'Availability integration test',
                ]
            )

        const timeOffId =
            timeOffResult.rows[0].id

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-10',
                })

            assert.equal(
                result.error,
                undefined
            )

            assert.ok(result.data)

            assert.ok(
                result.data.timeOff
            )

            assert.equal(
                result.data.timeOff.id,
                timeOffId
            )

            assert.deepEqual(
                result.data.effectiveWorkingWindow,
                {
                    available: false,
                    reason: 'TIME_OFF',
                    startTime: null,
                    endTime: null,
                }
            )

            assert.deepEqual(
                result.data.candidateSlots,
                []
            )

            assert.deepEqual(
                result.data.availableSlots,
                []
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM employee_time_off
                    WHERE id = $1
                `,
                [
                    timeOffId,
                ]
            )
        }
    }
)

test(
    'availability rejects employee not qualified for selected service',
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
                    'Availability Unqualified Test Service',
                    'Test',
                    30,
                    2500,
                    true,
                ]
            )

        const serviceId =
            serviceResult.rows[0].id

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId,
                    date: '2030-01-10',
                })

            assert.deepEqual(
                result,
                {
                    error: {
                        status: 400,
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
        }
    }
)

test(
    'availability rejects inactive employee',
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

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-10',
                })

            assert.deepEqual(
                result,
                {
                    error: {
                        status: 400,
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
        }
    }
)

test(
    'availability rejects inactive service',
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

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-10',
                })

            assert.deepEqual(
                result,
                {
                    error: {
                        status: 400,
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
        }
    }
)

test(
    'availability rejects inactive salon',
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

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-10',
                })

            assert.deepEqual(
                result,
                {
                    error: {
                        status: 400,
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
        }
    }
)

test(
    'availability allows slot starting exactly when existing appointment ends',
    async () => {
        const fixture =
            await getSeedFixture()

        const serviceResult =
            await pool.query(
                `
                    SELECT
                        price_cents,
                        default_duration_minutes
                    FROM services
                    WHERE id = $1
                    LIMIT 1
                `,
                [fixture.service_id]
            )

        assert.ok(
            serviceResult.rows[0],
            'Expected seeded service to exist.'
        )

        const service =
            serviceResult.rows[0]

        const appointmentResult =
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
                    '2030-01-09T10:00:00.000Z',
                    '2030-01-09T10:30:00.000Z',
                    service.price_cents,
                    30,
                    'confirmed',
                    'manual',
                    'Availability appointment boundary test',
                ]
            )

        const appointmentId =
            appointmentResult.rows[0].id

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-09',
                })

            assert.equal(
                result.error,
                undefined
            )

            assert.ok(result.data)

            assert.ok(
                !result.data.availableSlots.includes(
                    '11:00'
                )
            )

            assert.ok(
                result.data.availableSlots.includes(
                    '11:30'
                )
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM appointments
                    WHERE id = $1
                `,
                [appointmentId]
            )
        }
    }
)

test(
    'availability allows slot ending exactly when existing appointment starts',
    async () => {
        const fixture =
            await getSeedFixture()

        const serviceResult =
            await pool.query(
                `
                    SELECT
                        price_cents,
                        default_duration_minutes
                    FROM services
                    WHERE id = $1
                    LIMIT 1
                `,
                [fixture.service_id]
            )

        assert.ok(
            serviceResult.rows[0],
            'Expected seeded service to exist.'
        )

        const service =
            serviceResult.rows[0]

        const appointmentResult =
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
                    '2030-01-09T10:00:00.000Z',
                    '2030-01-09T10:30:00.000Z',
                    service.price_cents,
                    30,
                    'confirmed',
                    'manual',
                    'Availability reverse appointment boundary test',
                ]
            )

        const appointmentId =
            appointmentResult.rows[0].id

        try {
            const result =
                await getAvailabilityDayContext({
                    employeeId:
                        fixture.employee_id,
                    serviceId:
                        fixture.service_id,
                    date: '2030-01-09',
                })

            assert.equal(
                result.error,
                undefined
            )

            assert.ok(result.data)

            assert.ok(
                result.data.availableSlots.includes(
                    '10:30'
                )
            )

            assert.ok(
                !result.data.availableSlots.includes(
                    '11:00'
                )
            )
        } finally {
            await pool.query(
                `
                    DELETE FROM appointments
                    WHERE id = $1
                `,
                [appointmentId]
            )
        }
    }
)

test(
    'availability converts salon local day to correct UTC range',
    async () => {
        const fixture =
            await getSeedFixture()

        const result =
            await getAvailabilityDayContext({
                employeeId:
                    fixture.employee_id,
                serviceId:
                    fixture.service_id,
                date: '2030-01-09',
            })

        assert.equal(
            result.error,
            undefined
        )

        assert.ok(result.data)

        assert.equal(
            result.data.salon.timezone,
            'Europe/Zagreb'
        )

        assert.equal(
            result.data.rangeStart.toISOString(),
            '2030-01-08T23:00:00.000Z'
        )

        assert.equal(
            result.data.rangeEnd.toISOString(),
            '2030-01-09T23:00:00.000Z'
        )
    }
)

test(
    'availability respects daylight saving time in salon timezone',
    async () => {
        const fixture =
            await getSeedFixture()

        const result =
            await getAvailabilityDayContext({
                employeeId:
                    fixture.employee_id,
                serviceId:
                    fixture.service_id,
                date: '2030-07-10',
            })

        assert.equal(
            result.error,
            undefined
        )

        assert.ok(result.data)

        assert.equal(
            result.data.salon.timezone,
            'Europe/Zagreb'
        )

        assert.equal(
            result.data.rangeStart.toISOString(),
            '2030-07-09T22:00:00.000Z'
        )

        assert.equal(
            result.data.rangeEnd.toISOString(),
            '2030-07-10T22:00:00.000Z'
        )
    }
)