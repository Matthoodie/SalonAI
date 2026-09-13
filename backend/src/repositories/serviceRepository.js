import pool from '../database/pool.js'

export async function findServicesBySalonId(
  salonId
) {
  const result = await pool.query(
    `
      SELECT
        id,
        salon_id,
        name,
        category,
        price_cents,
        default_duration_minutes,
        active,
        created_at,
        updated_at
      FROM services
      WHERE salon_id = $1
      ORDER BY name ASC
    `,
    [salonId]
  )

  return result.rows
}

export async function insertService({
  salonId,
  name,
  category,
  priceCents,
  defaultDurationMinutes,
}) {
  const result = await pool.query(
    `
      INSERT INTO services (
        salon_id,
        name,
        category,
        price_cents,
        default_duration_minutes
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      RETURNING
        id,
        salon_id,
        name,
        category,
        price_cents,
        default_duration_minutes,
        active,
        created_at,
        updated_at
    `,
    [
      salonId,
      name,
      category,
      priceCents,
      defaultDurationMinutes,
    ]
  )

  return result.rows[0]
}

export async function updateServiceById({
  serviceId,
  salonId,
  name,
  category,
  priceCents,
  defaultDurationMinutes,
}) {
  const result = await pool.query(
    `
      UPDATE services
      SET
        name = $1,
        category = $2,
        price_cents = $3,
        default_duration_minutes = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
        AND salon_id = $6
      RETURNING
        id,
        salon_id,
        name,
        category,
        price_cents,
        default_duration_minutes,
        active,
        created_at,
        updated_at
    `,
    [
      name,
      category,
      priceCents,
      defaultDurationMinutes,
      serviceId,
      salonId,
    ]
  )

  return result.rows[0] ?? null
}

export async function updateServiceActiveById({
  serviceId,
  salonId,
  active,
}) {
  const result = await pool.query(
    `
      UPDATE services
      SET
        active = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND salon_id = $3
      RETURNING
        id,
        salon_id,
        name,
        category,
        price_cents,
        default_duration_minutes,
        active,
        created_at,
        updated_at
    `,
    [
      active,
      serviceId,
      salonId,
    ]
  )

  return result.rows[0] ?? null
}