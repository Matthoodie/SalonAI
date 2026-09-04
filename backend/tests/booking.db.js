import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
    createBooking,
} from '../src/services/bookingService.js'

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
        'Expected SalonAI booking seed fixture to exist.'
    )

    return result.rows[0]
}

test(
    'createBooking creates appointment from salon-local booking time',
    async () => {
        const fixture =
            await getSeedFixture()

        const result =
            await createBooking({
                salon_id:
                    fixture.salon_id,
                client_id:
                    fixture.client_id,
                employee_id:
                    fixture.employee_id,
                service_id:
                    fixture.service_id,
                date: '2030-01-09',
                start_time: '10:30',
                notes:
                    'Booking service integration test',
            })

        assert.equal(
            result.error,
            undefined
        )

        assert.ok(result.data)

        const appointment =
            result.data

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

            assert.equal(
                appointment.source,
                'manual'
            )
        } finally {
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
)

test(
    'createBooking rejects unavailable slot',
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
                    'Existing booking collision test appointment',
                ]
            )

        const existingAppointmentId =
            existingAppointmentResult.rows[0].id

        try {
            const result =
                await createBooking({
                    salon_id:
                        fixture.salon_id,
                    client_id:
                        fixture.client_id,
                    employee_id:
                        fixture.employee_id,
                    service_id:
                        fixture.service_id,
                    date: '2030-01-09',
                    start_time: '10:30',
                    notes:
                        'Should be rejected',
                })

            assert.deepEqual(
                result,
                {
                    error: {
                        status: 409,
                        code: 'APPOINTMENT_CONFLICT',
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
        }
    }
)