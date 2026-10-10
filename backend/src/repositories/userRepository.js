import pool from '../database/pool.js'

export async function findUserByAuthIdentity({
  authProvider,
  authSubject,
}) {
  const result = await pool.query(
    `
      SELECT
        id,
        auth_provider,
        auth_subject,
        email,
        display_name,
        active,
        created_at,
        updated_at
      FROM users
      WHERE auth_provider = $1
        AND auth_subject = $2
      LIMIT 1
    `,
    [
      authProvider,
      authSubject,
    ]
  )

  return result.rows[0] ?? null
}

export async function insertUserFromAuthIdentity({
  authProvider,
  authSubject,
  email,
  displayName,
}) {
  const result = await pool.query(
    `
      INSERT INTO users (
        auth_provider,
        auth_subject,
        email,
        display_name
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (
        auth_provider,
        auth_subject
      )
      DO NOTHING
      RETURNING
        id,
        auth_provider,
        auth_subject,
        email,
        display_name,
        active,
        created_at,
        updated_at
    `,
    [
      authProvider,
      authSubject,
      email,
      displayName,
    ]
  )

  return result.rows[0] ?? null
}