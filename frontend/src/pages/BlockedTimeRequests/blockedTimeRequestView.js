import { blockedLocalTimeToUtc } from '../../api/blockedTimeDateTime.js'
export { requestStatuses, requestActions, canCancelRequest, validateCancellationNote,
  appendRequestPage, formatRequestTimestamp } from '../TimeOffRequests/timeOffRequestView.js'
import { requestStatuses } from '../TimeOffRequests/timeOffRequestView.js'
export const blockedTimeTypes = { BREAK: 'Pauza', PRIVATE: 'Privatna obveza', MEETING: 'Sastanak', TRAINING: 'Edukacija', OTHER: 'Ostalo' }
export function requestDraftToPayload(draft, timezone) {
  if (!Object.hasOwn(blockedTimeTypes, draft.type)) throw new Error('Odaberite vrstu blokade.')
  if (typeof draft.note !== 'string' || [...draft.note].length > 250 || draft.note.includes('\0')) throw new Error('Napomena može imati najviše 250 znakova.')
  const startsAt = blockedLocalTimeToUtc(draft.date, draft.startTime, timezone)
  const endsAt = blockedLocalTimeToUtc(draft.date, draft.endTime, timezone)
  if (startsAt >= endsAt) throw new Error('Završetak mora biti nakon početka blokade.')
  return { startsAt, endsAt, type: draft.type, note: draft.note }
}
export function assertRequestPage(page, auth) {
  for (const row of page.requests) {
    const sameSalon = String(row.salon_id) === String(auth.current_salon.id)
    const own = String(row.requested_by_user_id) === String(auth.user.id) && String(row.requester_membership_id) === String(auth.membership.id)
    if (!sameSalon || (page.scope === 'self' && !own) || !Object.hasOwn(requestStatuses, row.status) ||
        !Object.hasOwn(blockedTimeTypes, row.type) || !Number.isFinite(Date.parse(row.starts_at)) ||
        !Number.isFinite(Date.parse(row.ends_at)) || Date.parse(row.starts_at) >= Date.parse(row.ends_at)) {
      throw Object.assign(new Error('Popis nije usklađen s odabranim računom i salonom. Osvježite aplikaciju.'), { code: 'BLOCKED_TIME_RESPONSE_INVALID' })
    }
  }
  return page
}
