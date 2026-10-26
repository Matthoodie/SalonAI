// The caller validates blockedTimes and holds the employee FOR UPDATE lock
// in the same transaction until all schedule changes are committed.
export async function assertEmployeeBlockedTimesAvailable(db, {
  salonId,
  employeeId,
  blockedTimes,
}) {
  if (blockedTimes.length === 0) return

  const result = await db.query(`
    SELECT a.id
    FROM appointments a
    WHERE a.salon_id = $1
      AND a.employee_id = $2
      AND a.status IN ('pending', 'confirmed')
      AND EXISTS (
        SELECT 1
        FROM jsonb_to_recordset($3::jsonb)
          AS requested(starts_at timestamptz, ends_at timestamptz)
        WHERE a.starts_at < requested.ends_at
          AND a.ends_at > requested.starts_at
      )
    ORDER BY a.starts_at, a.id
    LIMIT 1
  `, [salonId, employeeId, JSON.stringify(blockedTimes)])

  if (result.rows.length > 0) {
    const error = new Error(
      'Blokirano vrijeme preklapa se s aktivnim terminom zaposlenika. Najprije premjestite ili otkažite taj termin.'
    )
    error.code = 'EMPLOYEE_BLOCKED_TIME_APPOINTMENT_CONFLICT'
    error.statusCode = 409
    throw error
  }
}
