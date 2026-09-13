import pool from '../database/pool.js'

export async function findCalendarAppointments({
    salonId,
    rangeStart,
    rangeEnd,
    employeeId = null,
    status = null,
}) {
    const result = await pool.query(
        `
            SELECT
                a.id,
                a.salon_id,
                a.client_id,
                a.employee_id,
                a.service_id,
                a.starts_at,
                a.ends_at,
                a.price_cents,
                a.duration_minutes,
                a.status,
                a.source,
                a.notes,

                c.name AS client_name,

                e.name AS employee_name,

                s.name AS service_name,
                s.category AS service_category,
                s.default_duration_minutes
                    AS service_default_duration_minutes

            FROM appointments a

            JOIN clients c
                ON c.id = a.client_id
               AND c.salon_id = a.salon_id

            JOIN employees e
                ON e.id = a.employee_id
               AND e.salon_id = a.salon_id

            JOIN services s
                ON s.id = a.service_id
               AND s.salon_id = a.salon_id

            WHERE a.salon_id = $1

              AND a.starts_at < $3
              AND a.ends_at > $2

              AND (
                    $4::bigint IS NULL
                    OR a.employee_id = $4
              )

              AND (
                    $5::varchar IS NULL
                    OR a.status = $5
              )

            ORDER BY
                a.starts_at,
                e.name,
                a.id
        `,
        [
            salonId,
            rangeStart,
            rangeEnd,
            employeeId,
            status,
        ]
    )

    return result.rows
}