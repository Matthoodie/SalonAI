import pool from '../database/pool.js'

export async function findSalonPermissionOverride({
  salonId,
  role,
  permissionKey,
}, db = pool) {
  const result =
    await db.query(
      `
        SELECT
          permission_value
        FROM salon_permission_overrides
        WHERE salon_id = $1
          AND role = $2
          AND permission_key = $3
        LIMIT 1
      `,
      [
        salonId,
        role,
        permissionKey,
      ]
    )

  return result.rows[0] ?? null
}
