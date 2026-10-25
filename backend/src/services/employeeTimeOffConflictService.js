// The caller must validate timeOff and hold the employee row lock
// in the same transaction until the schedule write is committed.
export async function assertEmployeeTimeOffAvailable(db, {
  salonId,
  employeeId,
  timeOff,
}) {
  if (timeOff.length === 0) return

  const result = await db.query(
    `
      SELECT a.id
      FROM appointments a
      JOIN salons s ON s.id = a.salon_id
      WHERE a.salon_id = $1
        AND a.employee_id = $2
        AND a.status IN ('pending', 'confirmed')
        AND EXISTS (
          SELECT 1
          FROM jsonb_to_recordset($3::jsonb)
            AS requested(start_date date, end_date date)
          WHERE a.starts_at < (
            (requested.end_date + 1)::timestamp
            AT TIME ZONE s.timezone
          )
          AND a.ends_at > (
            requested.start_date::timestamp
            AT TIME ZONE s.timezone
          )
        )
      ORDER BY a.starts_at, a.id
      LIMIT 1
    `,
    [salonId, employeeId, JSON.stringify(timeOff)]
  )

  if (result.rows.length > 0) {
    const error = new Error(
      'Odsutnost se preklapa s aktivnim terminom zaposlenika. Najprije premjestite ili otkažite taj termin.'
    )
    error.code = 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT'
    error.statusCode = 409
    throw error
  }
}
