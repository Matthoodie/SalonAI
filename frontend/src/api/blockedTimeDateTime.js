import { getSalonLocalDateParts } from './salonDateTime.js'

// Enumerate offsets around the requested day; reject gaps and repeated local
// minutes instead of silently choosing one occurrence. No browser timezone use.
export function blockedLocalTimeToUtc(date, time, timezone) {
  if (typeof timezone !== 'string' || !timezone.trim()) throw new Error('Vremenska zona salona nije dostupna. Osvježite aplikaciju.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Unesite valjan datum i vrijeme.')
  }
  const base = Date.parse(`${date}T${time}:00.000Z`)
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 10) !== date || Number(date.slice(0, 4)) < 100) {
    throw new Error('Datum nije valjan.')
  }
  const offsets = new Set()
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = base + hours * 3600000
    const parts = getSalonLocalDateParts(new Date(instant).toISOString(), timezone)
    offsets.add(Date.parse(`${parts.date}T${parts.time}:00.000Z`) - instant)
  }
  const candidates = []
  for (const offset of offsets) {
    const iso = new Date(base - offset).toISOString()
    const parts = getSalonLocalDateParts(iso, timezone)
    if (parts.date === date && parts.time === time) candidates.push(iso)
  }
  if (candidates.length === 0) throw new Error('Odabrani sat ne postoji zbog promjene vremena. Odaberite drugo vrijeme.')
  if (candidates.length > 1) throw new Error('Odabrani sat ponavlja se zbog promjene vremena. Odaberite vrijeme izvan ponovljenog sata.')
  return candidates[0]
}
