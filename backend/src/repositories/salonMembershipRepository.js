import pool from '../database/pool.js'

export async function findMembershipsByUserId(
  userId
) {
  const result = await pool.query(
    `
      SELECT
        sm.id AS membership_id,
        sm.user_id,
        sm.salon_id,
        sm.role,
        sm.active AS membership_active,
        sm.created_at AS membership_created_at,
        sm.updated_at AS membership_updated_at,

        s.name AS salon_name,
        s.timezone AS salon_timezone,
        s.active AS salon_active
      FROM salon_memberships sm
      JOIN salons s
        ON s.id = sm.salon_id
      WHERE sm.user_id = $1
      ORDER BY sm.id
    `,
    [userId]
  )

  return result.rows
}