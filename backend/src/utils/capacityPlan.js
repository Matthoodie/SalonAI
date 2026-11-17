import { unionIntervals, intersectIntervals, subtractIntervals, intervalMilliseconds } from './capacityIntervals.js'

// Internal calculation contract, NOT an HTTP payload or an authorization boundary.
// A future repository adapter must provide complete, salon-scoped, effective UTC
// windows from one consistent database snapshot; see DASHBOARD_CAPACITY_PHASE1.md.
const MAX_EMPLOYEES = 500, MAX_ROWS = 25000, MAX_RANGE_MS = 32 * 86400000
const STATUSES = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])

function fail() { throw Object.assign(new TypeError('Invalid capacity calculation data.'), { code: 'CAPACITY_INVALID_DATA' }) }
function id(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail()
  return String(value)
}
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) fail()
  const n = Date.parse(value)
  const canonical = value.length === 20 ? value.slice(0, -1) + '.000Z' : value
  if (!Number.isFinite(n) || new Date(n).toISOString() !== canonical) fail()
  return n
}
function list(value, max = MAX_ROWS) {
  if (!Array.isArray(value) || value.length > max) fail()
  return value
}
function rowInterval(row) {
  if (!row || typeof row !== 'object') fail()
  const start = instant(row.starts_at), end = instant(row.ends_at)
  if (start >= end) fail()
  return [start, end]
}
function measures(working, blocked, occupied, unavailableBookings, overlap) {
  const working_ms = intervalMilliseconds(working), blocked_ms = intervalMilliseconds(blocked)
  const capacity_ms = working_ms - blocked_ms, occupied_ms = intervalMilliseconds(occupied)
  return { working_ms, blocked_ms, capacity_ms, occupied_ms, free_ms: capacity_ms - occupied_ms,
    outside_capacity_ms: intervalMilliseconds(unavailableBookings),
    overlapping_booking_ms: overlap,
    utilization_percent: capacity_ms === 0 ? null : occupied_ms / capacity_ms * 100 }
}

export function calculateCapacityPlan(input) {
  if (!input || typeof input !== 'object') fail()
  const salonId = id(input.salon_id), now = instant(input.as_of)
  const range = rowInterval(input.range)
  if (range[0] < now || range[1] - range[0] > MAX_RANGE_MS) fail()
  if (typeof input.timezone !== 'string' || !input.timezone.trim()) fail()
  try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format(now) } catch { fail() }
  const employees = list(input.employees, MAX_EMPLOYEES), seen = new Set(), bookingIds = new Set()
  let rowCount = 0
  const results = []
  for (const employee of employees) {
    if (!employee || typeof employee !== 'object') fail()
    const employeeId = id(employee.employee_id)
    if (id(employee.salon_id) !== salonId || seen.has(employeeId) || typeof employee.active !== 'boolean') fail()
    seen.add(employeeId)
    // Inactive employees still undergo validation, but do not contribute capacity.
    const read = (rows, appointments = false) => list(rows).map(row => {
      if (++rowCount > MAX_ROWS) fail()
      if (!row || id(row.salon_id) !== salonId || id(row.employee_id) !== employeeId) fail()
      const interval = rowInterval(row)
      if (appointments) {
        const bookingId = id(row.id)
        if (bookingIds.has(bookingId) || !STATUSES.has(row.status)) fail()
        bookingIds.add(bookingId)
      }
      return { interval, status: row.status }
    })
    const work = read(employee.working_windows), block = read(employee.blocks)
    const appointments = read(employee.appointments, true)
    if (!employee.active) continue
    const working = intersectIntervals(work.map(r => r.interval), [range])
    const blocked = intersectIntervals(block.map(r => r.interval), working)
    const capacity = subtractIntervals(working, blocked)
    // Match the current booking collision rule: every non-cancelled appointment
    // reserves time. Future completed/no-show records are counted AND flagged.
    const held = appointments.filter(r => r.status !== 'cancelled')
      .map(r => ({ ...r, clipped: intersectIntervals([r.interval], [range]) }))
      .filter(r => r.clipped.length)
    const bookings = unionIntervals(held.flatMap(r => r.clipped))
    const occupied = intersectIntervals(bookings, capacity)
    const outside = subtractIntervals(bookings, capacity)
    const rawBookingMs = held.reduce((n, r) => n + intervalMilliseconds(r.clipped), 0)
    const overlap = rawBookingMs - intervalMilliseconds(bookings)
    results.push({ employee_id: employeeId,
      ...measures(working, blocked, occupied, outside, overlap),
      booking_count: held.length,
      unusual_status_count: held.filter(r => r.status === 'completed' || r.status === 'no_show').length,
      // Retained for the future heatmap adapter. UTC identity preserves both
      // occurrences of a repeated autumn hour; local labels must not be keys.
      capacity_intervals: capacity, occupied_intervals: occupied })
  }
  const keys = ['working_ms', 'blocked_ms', 'capacity_ms', 'occupied_ms', 'free_ms',
    'outside_capacity_ms', 'overlapping_booking_ms', 'booking_count', 'unusual_status_count']
  const totals = Object.fromEntries(keys.map(key => [key, results.reduce((n, row) => n + row[key], 0)]))
  if (Object.values(totals).some(n => !Number.isSafeInteger(n) || n < 0)) fail()
  totals.utilization_percent = totals.capacity_ms === 0 ? null : totals.occupied_ms / totals.capacity_ms * 100
  return { salon_id: salonId, timezone: input.timezone, as_of: input.as_of,
    range: { ...input.range }, basis: 'current_schedule_plan', active_employee_count: results.length,
    totals, employees: results }
}
