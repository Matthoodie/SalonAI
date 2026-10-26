function fail(message, code = 'APPROVED_BLOCKED_TIME_PROTECTED', statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode })
}
function sameRecord(entry, row) {
  return String(entry.id) === String(row.id) && String(entry.source_request_id) === String(row.source_request_id) &&
    new Date(entry.starts_at).getTime() === new Date(row.starts_at).getTime() &&
    new Date(entry.ends_at).getTime() === new Date(row.ends_at).getTime() &&
    entry.type === row.type && (entry.reason ?? '') === (row.reason ?? '')
}
export async function prepareManualBlockedTimeReplacement(db, { salonId, employeeId, blockedTimes }) {
  const result = await db.query(`
    SELECT b.id, b.source_request_id, b.starts_at, b.ends_at, b.type, b.reason
    FROM employee_blocked_times b JOIN employees e ON e.id = b.employee_id
    WHERE e.salon_id = $1 AND e.id = $2 AND b.source_request_id IS NOT NULL
    ORDER BY b.id
  `, [salonId, employeeId])
  const remaining = [...blockedTimes]
  for (const approved of result.rows) {
    const index = remaining.findIndex(entry => sameRecord(entry, approved))
    if (index < 0) throw fail('Odobrenu blokadu nije moguće izmijeniti ili izbrisati kroz profil. Osvježite podatke; otkazivanje je dostupno među zahtjevima za blokirano vrijeme.')
    remaining.splice(index, 1)
  }
  if (remaining.some(entry => entry.source_request_id != null)) {
    throw fail('Popis sadrži zastarjelu ili dupliciranu odobrenu blokadu. Osvježite profil prije spremanja.')
  }
  if (remaining.some(entry => result.rows.some(approved =>
    new Date(entry.starts_at) < new Date(approved.ends_at) &&
    new Date(entry.ends_at) > new Date(approved.starts_at)))) {
    throw fail('Ručna blokada ne smije preklapati odobrenu blokadu. Odaberite drugo razdoblje.', 'APPROVED_BLOCKED_TIME_CONFLICT')
  }
  return remaining
}
