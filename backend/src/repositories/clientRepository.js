import pool from '../database/pool.js'

export async function findClientsBySalonId(salonId) {
  const result = await pool.query(
    `
      SELECT
        id,
        salon_id,
        name,
        phone_country_code,
        phone_number,
        phone_normalized,
        active,
        created_at,
        updated_at
      FROM clients
      WHERE salon_id = $1
      ORDER BY name, id
    `,
    [salonId]
  )

  return result.rows
}

export async function insertClient({
  salonId,
  name,
  phoneCountryCode,
  phoneNumber,
  phoneNormalized,
}) {
  const result = await pool.query(
    `
      INSERT INTO clients (
        salon_id,
        name,
        phone_country_code,
        phone_number,
        phone_normalized
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        salon_id,
        name,
        phone_country_code,
        phone_number,
        phone_normalized,
        active,
        created_at,
        updated_at
    `,
    [
      salonId,
      name,
      phoneCountryCode,
      phoneNumber,
      phoneNormalized,
    ]
  )

  return result.rows[0]
}

export async function updateClient({
  clientId,
  salonId,
  name,
  phoneCountryCode,
  phoneNumber,
  phoneNormalized,
}) {
  const result = await pool.query(
    `
      UPDATE clients
      SET
        name = $3,
        phone_country_code = $4,
        phone_number = $5,
        phone_normalized = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND salon_id = $2
      RETURNING
        id,
        salon_id,
        name,
        phone_country_code,
        phone_number,
        phone_normalized,
        active,
        created_at,
        updated_at
    `,
    [
      clientId,
      salonId,
      name,
      phoneCountryCode,
      phoneNumber,
      phoneNormalized,
    ]
  )

  return result.rows[0] ?? null
}