import pool from '../database/pool.js'

export async function findClientsBySalonId(salonId) {
  const result = await pool.query(
    `
      SELECT
        id,
        salon_id,
        name,
        is_occasional,
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

export async function findClientById(
  clientId,
  salonId,
  db = pool
) {
  const result = await db.query(
    `
      SELECT
        id,
        salon_id,
        name,
        is_occasional,
        active
      FROM clients
      WHERE id = $1
        AND salon_id = $2
      LIMIT 1
    `,
    [clientId, salonId]
  )

  return result.rows[0] ?? null
}

export async function insertClient({
  salonId,
  name,
  phoneCountryCode,
  phoneNumber,
  phoneNormalized,
  isOccasional = false,
}, db = pool) {
  const result = await db.query(
    `
      INSERT INTO clients (
        salon_id,
        name,
        phone_country_code,
        phone_number,
        phone_normalized,
        is_occasional
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        salon_id,
        name,
        is_occasional,
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
      isOccasional,
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
  isOccasional,
}) {
  const result = await pool.query(
    `
      UPDATE clients
      SET
        name = $3,
        phone_country_code = $4,
        phone_number = $5,
        phone_normalized = $6,
        is_occasional = COALESCE($7::boolean, is_occasional),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND salon_id = $2
      RETURNING
        id,
        salon_id,
        name,
        is_occasional,
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
      isOccasional ?? null,
    ]
  )

  return result.rows[0] ?? null
}

export async function updateClientActive({
  clientId,
  salonId,
  active,
}) {
  const result = await pool.query(
    `
      UPDATE clients
      SET
        active = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND salon_id = $2
      RETURNING
        id,
        salon_id,
        name,
        is_occasional,
        phone_country_code,
        phone_number,
        phone_normalized,
        active,
        created_at,
        updated_at
    `,
    [clientId, salonId, active]
  )

  return result.rows[0] ?? null
}

export async function searchClientsForBooking({
  salonId,
  nameQuery,
  phoneQuery,
}) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        CASE
          WHEN phone_normalized IS NULL THEN NULL
          ELSE '•••• ' || right(phone_normalized, 4)
        END AS phone_hint
      FROM clients
      WHERE salon_id = $1
        AND active = true
        AND (
          (
            $2::text IS NOT NULL
            AND strpos(lower(name), lower($2::text)) > 0
          )
          OR
          (
            $3::text IS NOT NULL
            AND strpos(
              regexp_replace(phone_normalized, '[^0-9]', '', 'g'),
              $3::text
            ) > 0
          )
        )
      ORDER BY name, id
      LIMIT 10
    `,
    [salonId, nameQuery, phoneQuery]
  )

  return result.rows
}