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