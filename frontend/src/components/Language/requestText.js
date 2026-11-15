import { requestMessages } from './requestMessages.js'
import { clientText, clientError } from './clientText.js'
import { overviewLocale } from './overviewText.js'
import { validDateKey, formatRequestDate } from '../../pages/TimeOffRequests/timeOffRequestView.js'
export function requestText(language, source) {
  if (typeof source !== 'string') return source
  const key = source.trim()
  return language === 'en' && Object.hasOwn(requestMessages, key)
    ? source.replace(key, () => requestMessages[key]) : clientText(language, source)
}
export function requestError(language, error) {
  const source = typeof error === 'string' ? error : error?.message
  return Object.hasOwn(requestMessages, source?.trim() || '')
    ? requestText(language, source) : clientError(language, error)
}
export function requestNotice(language, value) {
  return (Array.isArray(value) ? value : [value]).map(source => requestText(language, source)).join(' ')
}
export function requestDate(language, value) {
  if (!validDateKey(value)) return '—'
  if (language !== 'en') return formatRequestDate(value)
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))
}
export function requestTimestamp(language, value, timezone) {
  if (!value || !timezone) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(overviewLocale(language), { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(date)
  } catch { return '—' }
}
export function requestConfirmation(language, action, kind, name, start, end) {
  const en = language === 'en', blocked = kind === 'blocked', period = `${start} – ${end}`
  if (action === 'withdraw') return en ? `Withdraw the request for ${period}?` : `Povući zahtjev za ${period}?`
  if (action === 'cancel') return en
    ? `Cancel the approved ${blocked ? 'blocked time' : 'time off'} for ${name || 'the selected employee'} for ${period}? It will be removed from the schedule; the history will be retained.`
    : `Otkazati odobrenu ${blocked ? 'blokadu' : 'odsutnost'} zaposlenika ${name || ''} za ${period}? ${blocked ? 'Blokada' : 'Odsutnost'} će biti uklonjena iz rasporeda, a povijest ostaje spremljena.`
  return en
    ? `${action === 'approved' ? 'Approve' : 'Reject'} the request from ${name || 'the selected employee'} for ${period}?`
    : `${action === 'approved' ? 'Odobriti' : 'Odbiti'} zahtjev zaposlenika ${name || (blocked ? 'za odabranu blokadu' : 'za odabranu odsutnost')} za ${period}?`
}
