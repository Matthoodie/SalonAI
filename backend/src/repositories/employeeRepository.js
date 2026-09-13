import pool from '../database/pool.js'

export async function findEmployeesBySalonId(
  salonId
) {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.salon_id,
        e.name,
        e.active,
        e.created_at,
        e.updated_at,

        COALESCE(
          (
            SELECT json_agg(
              es.service_id
              ORDER BY es.service_id
            )
            FROM employee_services es
            WHERE es.employee_id = e.id
              AND es.salon_id = e.salon_id
          ),
          '[]'::json
        ) AS service_ids,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'day_of_week',
                ewh.day_of_week,
                'start_time',
                ewh.start_time,
                'end_time',
                ewh.end_time
              )
              ORDER BY ewh.day_of_week
            )
            FROM employee_working_hours ewh
            WHERE ewh.employee_id = e.id
          ),
          '[]'::json
        ) AS working_hours

      FROM employees e
      WHERE e.salon_id = $1
      ORDER BY e.name ASC
    `,
    [salonId]
  )

  return result.rows
}