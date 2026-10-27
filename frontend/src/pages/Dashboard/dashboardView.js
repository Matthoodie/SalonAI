export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const dateFormatters = new Map()

export function salonDate(instant, timeZone) {
  if (!timeZone) throw new Error('Nedostaje vremenska zona salona.')
  if (!dateFormatters.has(timeZone)) dateFormatters.set(timeZone, new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }))
  const parts = Object.fromEntries(dateFormatters.get(timeZone).formatToParts(new Date(instant)).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function shiftDate(date, days) {
  const instant = new Date(`${date}T00:00:00Z`)
  instant.setUTCDate(instant.getUTCDate() + days)
  return instant.toISOString().slice(0, 10)
}

export function periodRange(period, today, from, to) {
  if (!validDate(today)) throw new Error('Datum salona nije valjan.')
  if (period === 'range' || period === 'custom') {
    const end = period === 'custom' ? from : to
    if (!validDate(from) || !validDate(end)) throw new Error('Unesite valjane datume.')
    if (from > end) throw new Error('Početni datum mora biti prije završnog datuma ili jednak njemu.')
    return { from, to: end }
  }
  if (period === 'today') return { from: today, to: today }
  if (period === 'yesterday') return { from: shiftDate(today, -1), to: shiftDate(today, -1) }
  if (period === 'last7') return { from: shiftDate(today, -6), to: today }
  if (period === 'last30') return { from: shiftDate(today, -29), to: today }
  throw new Error('Nepoznato razdoblje.')
}

export function summarizeAppointments(rows, range, timeZone) {
  const selected = rows.filter(row => {
    const date = salonDate(row.startsAt, timeZone)
    return date >= range.from && date <= range.to
  })
  const count = status => selected.filter(row => row.statusCode === status).length
  const completed = selected.filter(row => row.statusCode === 'completed')
  let valueCents = 0
  let missingPrices = 0
  for (const row of completed) {
    const value = Number(row.priceCents)
    if (row.priceCents === null || row.priceCents === undefined || row.priceCents === '' || !Number.isSafeInteger(value) || value < 0) missingPrices++
    else valueCents += value
  }
  return {
    total: selected.length, active: count('pending') + count('confirmed'),
    completed: completed.length, cancelled: count('cancelled'), noShow: count('no_show'),
    valueCents, missingPrices,
  }
}

export function scheduleView(rows, now, timeZone) {
  const instant = new Date(now).getTime()
  const today = salonDate(now, timeZone)
  const sorted = [...rows].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt) || String(a.id).localeCompare(String(b.id)))
  const upcoming = sorted.filter(row => ['pending', 'confirmed'].includes(row.statusCode) && new Date(row.startsAt).getTime() >= instant)
  return { today: sorted.filter(row => salonDate(row.startsAt, timeZone) === today), upcoming: upcoming.slice(0, 5) }
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('hr-HR', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`))
}
export function formatMoney(cents) {
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
export function appointmentCount(count) {
  return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'termin' : 'termina'}`
}
