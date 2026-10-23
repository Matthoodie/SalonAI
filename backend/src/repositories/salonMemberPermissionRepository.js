import pool from '../database/pool.js'

export async function findMemberPermissionOverride({
  salonId,
  membershipId,
  permissionKey,
}) {
  const result = await pool.query(
    `
      SELECT p.permission_value

      FROM salon_member_permission_overrides p

      JOIN salon_memberships sm
        ON sm.id = p.membership_id
        AND sm.salon_id = p.salon_id

      JOIN users u
        ON u.id = sm.user_id

      JOIN salons s
        ON s.id = sm.salon_id

      WHERE p.salon_id = $1
        AND p.membership_id = $2
        AND p.permission_key = $3
        AND sm.role = 'employee'
        AND sm.active = true
        AND u.active = true
        AND s.active = true

      LIMIT 1
    `,
    [salonId, membershipId, permissionKey]
  )

  return result.rows[0] ?? null
}