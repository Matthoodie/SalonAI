function signature(entry) {
  return JSON.stringify([
    entry.start_date,
    entry.end_date,
    entry.type,
    entry.note ?? '',
  ])
}

// The caller validates the submitted array and holds the employee row lock
// until the replacement transaction finishes. Legacy forms do not send IDs.
export async function prepareManualTimeOffReplacement(db, {
  salonId,
  employeeId,
  timeOff,
}) {
  const result = await db.query(`
    SELECT eto.start_date::text, eto.end_date::text, eto.type, eto.note
    FROM employee_time_off eto
    JOIN employees e ON e.id = eto.employee_id
    WHERE e.salon_id = $1 AND e.id = $2
      AND eto.source_request_id IS NOT NULL
    ORDER BY eto.id
  `, [salonId, employeeId])

  if (result.rows.length === 0) return timeOff

  const remaining = [...timeOff]
  const protectedSignatures = new Set()

  for (const approved of result.rows) {
    const key = signature(approved)
    protectedSignatures.add(key)
    const index = remaining.findIndex((entry) => signature(entry) === key)
    if (index === -1) {
      const error = new Error(
        'Odobrenu odsutnost nije moguće ukloniti ili promijeniti kroz profil zaposlenika. Osvježite podatke i zadržite odobrenu odsutnost u popisu.'
      )
      error.code = 'APPROVED_TIME_OFF_PROTECTED'
      error.statusCode = 409
      throw error
    }
    remaining.splice(index, 1)
  }

  if (remaining.some((entry) => protectedSignatures.has(signature(entry)))) {
    const error = new Error('Odobrena odsutnost ne smije biti duplicirana u popisu.')
    error.code = 'APPROVED_TIME_OFF_DUPLICATED'
    error.statusCode = 400
    throw error
  }

  return remaining
}
