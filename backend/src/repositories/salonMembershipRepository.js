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
        sm.employee_id,
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

export async function findMembersBySalonId(salonId) {
  const result = await pool.query(
    `
      SELECT
        sm.id,
        sm.salon_id,
        sm.user_id,
        sm.role,
        sm.active AS membership_active,
        sm.created_at,

        u.email,
        u.display_name,
        u.active AS user_active,

        sm.employee_id,
        e.name AS employee_name,
        e.active AS employee_active

      FROM salon_memberships sm

      JOIN users u
        ON u.id = sm.user_id

      LEFT JOIN employees e
        ON e.id = sm.employee_id
        AND e.salon_id = sm.salon_id

      WHERE sm.salon_id = $1

      ORDER BY
        CASE sm.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          ELSE 2
        END,
        lower(u.email),
        sm.id
    `,
    [salonId]
  )

  return result.rows
}