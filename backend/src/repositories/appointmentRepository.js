import pool from '../database/pool.js'

export async function findAllAppointments() {
    const result = await pool.query(`
    SELECT
      id,
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
      notes,
      created_at,
      updated_at
    FROM appointments
    ORDER BY starts_at
  `)

    return result.rows
}

export async function findAppointmentById(id) {
    const result = await pool.query(
        `
      SELECT
        id,
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
        notes,
        created_at,
        updated_at
      FROM appointments
      WHERE id = $1
      LIMIT 1
    `,
        [id]
    )

    return result.rows[0] ?? null
}

export async function findServiceById(serviceId) {
    const result = await pool.query(
        `
      SELECT
        id,
        salon_id,
        price_cents,
        default_duration_minutes,
        active
      FROM services
      WHERE id = $1
      LIMIT 1
    `,
        [serviceId]
    )

    return result.rows[0] ?? null
}

export async function insertAppointment({
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
    notes,
}) {
    const result = await pool.query(
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
      RETURNING
        id,
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
        notes,
        created_at,
        updated_at
    `,
        [
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
            notes,
        ]
    )

    return result.rows[0]
}

export async function findEmployeeById(employeeId) {
    const result = await pool.query(
        `
      SELECT
        id,
        salon_id,
        name,
        active
      FROM employees
      WHERE id = $1
      LIMIT 1
    `,
        [employeeId]
    )

    return result.rows[0] ?? null
}

export async function findEmployeeDateOverride(
    employeeId,
    date
) {
    const result = await pool.query(
        `
      SELECT
        employee_id,
        date,
        enabled,
        start_time,
        end_time
      FROM employee_date_overrides
      WHERE employee_id = $1
        AND date = $2
      LIMIT 1
    `,
        [
            employeeId,
            date,
        ]
    )

    return result.rows[0] ?? null
}

export async function findEmployeeTimeOff(
    employeeId,
    date
) {
    const result = await pool.query(
        `
      SELECT
        id,
        employee_id,
        start_date,
        end_date,
        type,
        note
      FROM employee_time_off
      WHERE employee_id = $1
        AND $2::date BETWEEN start_date AND end_date
      ORDER BY start_date
      LIMIT 1
    `,
        [
            employeeId,
            date,
        ]
    )

    return result.rows[0] ?? null
}

export async function findEmployeeBlockedTimeOverlap(
    employeeId,
    startsAt,
    endsAt
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
      LIMIT 1
    `,
        [
            employeeId,
            startsAt,
            endsAt,
        ]
    )

    return result.rows[0] ?? null
}

export async function findEmployeeWorkingHours(
    employeeId,
    dayOfWeek
) {
    const result = await pool.query(
        `
      SELECT
        employee_id,
        day_of_week,
        start_time,
        end_time
      FROM employee_working_hours
      WHERE employee_id = $1
        AND day_of_week = $2
      LIMIT 1
    `,
        [
            employeeId,
            dayOfWeek,
        ]
    )

    return result.rows[0] ?? null
}


export async function findSalonById(salonId) {
    const result = await pool.query(
        `
      SELECT
        id,
        name,
        timezone,
        active
      FROM salons
      WHERE id = $1
      LIMIT 1
    `,
        [salonId]
    )

    return result.rows[0] ?? null
}