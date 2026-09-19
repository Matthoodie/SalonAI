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