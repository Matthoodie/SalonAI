export async function readinessState(db, salonId) {
  const state = (await db.query('SELECT status FROM salon_onboarding WHERE salon_id=$1 FOR UPDATE', [salonId])).rows[0]
  const setup = (await db.query('SELECT * FROM salon_setup WHERE salon_id=$1 FOR SHARE', [salonId])).rows[0] ?? null
  const result = (await db.query(`SELECT
    (SELECT count(*)::int FROM employees WHERE salon_id=$1 AND active) AS employees,
    (SELECT count(*)::int FROM services WHERE salon_id=$1 AND active) AS services,
    (SELECT count(*)::int FROM services s WHERE s.salon_id=$1 AND s.active AND NOT EXISTS (
      SELECT 1 FROM employee_services es JOIN employees e ON e.id=es.employee_id AND e.salon_id=es.salon_id
      WHERE es.salon_id=s.salon_id AND es.service_id=s.id AND e.active AND EXISTS (
        SELECT 1 FROM employee_working_hours h WHERE h.employee_id=e.id AND h.start_time<h.end_time
      )
    )) AS uncovered_services`, [salonId])).rows[0]
  return { status: state?.status ?? 'not_required', setup, counts: result }
}
