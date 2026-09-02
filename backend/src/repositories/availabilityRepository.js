import pool from '../database/pool.js'

export async function findEmployeeBlockedTimesForRange(
    employeeId,
    rangeStart,
    rangeEnd
) {
    const result = await pool.query(
        `
      SELECT
        id,
        employee_id,
        starts_at,
        ends_at,
        reason
      FROM employee_blocked_times
      WHERE employee_id = $1
        AND starts_at < $3
        AND ends_at > $2
      ORDER BY starts_at
    `,
        [
            employeeId,
            rangeStart,
            rangeEnd,
        ]
    )

    return result.rows
}

export async function findEmployeeAppointmentsForRange(
    employeeId,
    rangeStart,
    rangeEnd
) {
    const result = await pool.query(
        `
      SELECT
        id,
        employee_id,
        service_id,
        starts_at,
        ends_at,
        status
      FROM appointments
      WHERE employee_id = $1
        AND status <> 'cancelled'
        AND starts_at < $3
        AND ends_at > $2
      ORDER BY starts_at
    `,
        [
            employeeId,
            rangeStart,
            rangeEnd,
        ]
    )

    return result.rows
}

export async function findEmployeeServiceQualification(
    employeeId,
    serviceId,
    salonId
) {
    const result = await pool.query(
        `
      SELECT
        employee_id,
        service_id,
        salon_id
      FROM employee_services
      WHERE employee_id = $1
        AND service_id = $2
        AND salon_id = $3
      LIMIT 1
    `,
        [
            employeeId,
            serviceId,
            salonId,
        ]
    )

    return result.rows[0] ?? null
}