export const timeOffTypes = {
  vacation: 'Godišnji odmor', sick: 'Bolovanje', training: 'Edukacija',
  personal: 'Osobni razlozi', other: 'Ostalo',
}
export const requestStatuses = {
  pending: 'Na čekanju', approved: 'Odobreno', rejected: 'Odbijeno', withdrawn: 'Povučeno', cancelled: 'Otkazano',
}
export function validDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function validateRequestDraft(draft) {
  if (!validDateKey(draft.startDate) || !validDateKey(draft.endDate)) return 'Unesite valjane datume početka i završetka.'
  if (draft.startDate > draft.endDate) return 'Završetak ne može biti prije početka odsutnosti.'
  if (!Object.hasOwn(timeOffTypes, draft.type)) return 'Odaberite vrstu odsutnosti.'
  if (typeof draft.note !== 'string' || [...draft.note].length > 500 || draft.note.includes('\0')) return 'Napomena može sadržavati najviše 500 znakova.'
  return ''
}
export function formatRequestDate(value) {
  if (!validDateKey(value)) return '—'
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}.`
}
export function formatRequestTimestamp(value, timezone) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('hr-HR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}
export function requestActions(row, scope, authContext) {
  if (row.status !== 'pending' || String(row.salon_id) !== String(authContext.current_salon.id)) return { withdraw: false, review: false }
  const sameUser = String(row.requested_by_user_id) === String(authContext.user.id)
  const sameEmployee = authContext.membership.employee_id != null && String(row.employee_id) === String(authContext.membership.employee_id)
  return {
    withdraw: sameUser && String(row.requester_membership_id) === String(authContext.membership.id),
    review: scope === 'salon' && !sameUser && !sameEmployee,
  }
}
export function assertRequestPage(page, authContext) {
  for (const row of page.requests) {
    const sameSalon = String(row.salon_id) === String(authContext.current_salon.id)
    const own = String(row.requested_by_user_id) === String(authContext.user.id) && String(row.requester_membership_id) === String(authContext.membership.id)
    if (!sameSalon || (page.scope === 'self' && !own) || !Object.hasOwn(requestStatuses, row.status) ||
        !Object.hasOwn(timeOffTypes, row.type) || !validDateKey(row.start_date) || !validDateKey(row.end_date)) {
      throw Object.assign(new Error('Popis nije usklađen s odabranim računom i salonom. Osvježite aplikaciju.'), { code: 'TIME_OFF_RESPONSE_INVALID' })
    }
  }
  return page
}
export function appendRequestPage(previous, next) {
  if (!previous || previous.scope !== next.scope) return next
  const rows = new Map(previous.requests.map(row => [String(row.id), row]))
  for (const row of next.requests) rows.set(String(row.id), row)
  return { ...next, requests: [...rows.values()] }
}

export function canCancelRequest(row, scope, authContext) {
  return row.status === 'approved' && scope === 'salon' &&
    String(row.salon_id) === String(authContext.current_salon.id) &&
    String(row.requested_by_user_id) !== String(authContext.user.id) &&
    (authContext.membership.employee_id == null ||
      String(row.employee_id) !== String(authContext.membership.employee_id))
}

export function validateCancellationNote(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Unesite razlog otkazivanja.'
  if ([...value].length > 500 || value.includes('\0')) return 'Razlog može sadržavati najviše 500 znakova.'
  return ''
}
