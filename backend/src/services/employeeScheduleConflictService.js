// Call only after locking the employee row in the same transaction as the write.
// Inputs are complete replacement arrays already validated by employeeService.
function time(value) {
  return value?.length === 5 ? `${value}:00` : value
}

function windowFor(date, day, hours, overrides) {
  const override = overrides.find((row) => row.date === date)
  const row = override ?? hours.find((entry) => Number(entry.day_of_week) === day)
  if (!row || row.enabled === false) return null
  return [time(row.start_time), time(row.end_time)]
}

function localParts(formatter, value) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value))
    .filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    day: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday],
  }
}

export function findScheduleConflict({
  appointments, timezone, currentWorkingHours, currentDateOverrides,
  workingHours = currentWorkingHours, dateOverrides = currentDateOverrides,
}) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23',
  })
  for (const appointment of appointments) {
    const start = localParts(formatter, appointment.starts_at)
    const end = localParts(formatter, appointment.ends_at)
    const before = windowFor(start.date, start.day, currentWorkingHours, currentDateOverrides)
    const after = windowFor(start.date, start.day, workingHours, dateOverrides)
    // Unchanged effective days must not prevent unrelated profile edits,
    // even when legacy data already contains an out-of-hours appointment.
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    if (!after || start.date !== end.date || start.time < after[0] || end.time > after[1]) {
      return { appointmentId: appointment.id, date: start.date }
    }
  }
  return null
}

export async function assertEmployeeScheduleAvailable(db, {
  salonId, employeeId, workingHours, dateOverrides,
}) {
  if (workingHours === undefined && dateOverrides === undefined) return
  const salon = await db.query(`
    SELECT s.timezone FROM salons s JOIN employees e ON e.salon_id = s.id
    WHERE s.id = $1 AND e.id = $2
  `, [salonId, employeeId])
  if (!salon.rows[0]) {
    const error = new Error('Employee was not found.')
    error.code = 'EMPLOYEE_NOT_FOUND'
    error.statusCode = 404
    throw error
  }
  const hours = await db.query(`
    SELECT day_of_week, start_time::text, end_time::text
    FROM employee_working_hours WHERE employee_id = $1
  `, [employeeId])
  const overrides = await db.query(`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, enabled, start_time::text, end_time::text
    FROM employee_date_overrides WHERE employee_id = $1
  `, [employeeId])
  const appointments = await db.query(`
    SELECT id, starts_at, ends_at FROM appointments
    WHERE salon_id = $1 AND employee_id = $2 AND status IN ('pending', 'confirmed')
    ORDER BY starts_at, id
  `, [salonId, employeeId])
  const conflict = findScheduleConflict({
    appointments: appointments.rows, timezone: salon.rows[0].timezone,
    currentWorkingHours: hours.rows, currentDateOverrides: overrides.rows,
    workingHours, dateOverrides,
  })
  if (conflict) {
    const error = new Error(
      'Promjena rasporeda ostavila bi aktivan termin izvan radnog vremena. Najprije premjestite ili otkažite termin.'
    )
    error.code = 'EMPLOYEE_SCHEDULE_APPOINTMENT_CONFLICT'
    error.statusCode = 409
    throw error
  }
}
