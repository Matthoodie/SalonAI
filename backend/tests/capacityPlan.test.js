import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCapacityPlan as calculate } from '../src/utils/capacityPlan.js'

const H = 3600000
const utc = time => `2026-11-17T${time}:00Z`
const interval = (start, end, employee = 1) => ({ salon_id: 7, employee_id: employee, starts_at: utc(start), ends_at: utc(end) })
const booking = (start, end, status = 'confirmed', id = 1, employee = 1) => ({ ...interval(start, end, employee), status, id })
const person = (id = 1) => ({ employee_id: id, salon_id: 7, active: true,
  working_windows: [interval('08:00', '16:00', id)], blocks: [], appointments: [] })
const input = () => ({ salon_id: 7, timezone: 'Europe/Zagreb', as_of: utc('07:00'),
  range: { starts_at: utc('08:00'), ends_at: utc('18:00') }, employees: [person()] })
const totals = data => calculate(data).totals

test('capacity plan: eight working hours minus one blocked hour and two booked hours', () => {
  const data = input(), e = data.employees[0]
  e.blocks = [interval('12:00', '13:00')]; e.appointments = [booking('09:00', '11:00')]
  const r = totals(data)
  assert.equal(r.working_ms, 8 * H); assert.equal(r.blocked_ms, H)
  assert.equal(r.capacity_ms, 7 * H); assert.equal(r.occupied_ms, 2 * H); assert.equal(r.free_ms, 5 * H)
  assert.ok(Math.abs(r.utilization_percent - 200 / 7) < 1e-10)
})
test('capacity plan: empty effective windows represent a day off or approved absence', () => {
  const data = input(); data.employees[0].working_windows = []
  const r = totals(data)
  assert.equal(r.capacity_ms, 0); assert.equal(r.utilization_percent, null)
})
test('capacity plan: free working time has zero utilization, unlike unavailable capacity', () => {
  assert.equal(totals(input()).utilization_percent, 0)
  const data = input(); data.employees = []
  assert.equal(totals(data).utilization_percent, null)
})
test('capacity plan: overlapping blocks are counted once and clipped to working time', () => {
  const data = input(); data.employees[0].blocks = [interval('07:00', '10:00'), interval('09:00', '11:00'), interval('17:00', '18:00')]
  assert.equal(totals(data).blocked_ms, 3 * H)
})
test('capacity plan: overlapping appointments reserve union time and expose excess minutes', () => {
  const data = input(); data.employees[0].appointments = [booking('09:00', '11:00'), booking('10:00', '12:00', 'confirmed', 2)]
  const r = totals(data)
  assert.equal(r.occupied_ms, 3 * H); assert.equal(r.overlapping_booking_ms, H); assert.equal(r.booking_count, 2)
})
test('capacity plan: outside-hours and blocked-time bookings are reported separately', () => {
  const data = input(), e = data.employees[0]
  e.blocks = [interval('12:00', '13:00')]
  e.appointments = [booking('11:00', '14:00'), booking('16:00', '17:00', 'confirmed', 2)]
  const r = totals(data)
  assert.equal(r.occupied_ms, 2 * H); assert.equal(r.outside_capacity_ms, 2 * H)
  assert.equal(r.capacity_ms, 7 * H)
})
test('capacity plan: pending reserves time, cancelled does not, unusual future statuses are flagged', () => {
  const data = input()
  data.employees[0].appointments = [booking('08:00', '09:00', 'pending'), booking('09:00', '10:00', 'cancelled', 2),
    booking('10:00', '11:00', 'completed', 3), booking('11:00', '12:00', 'no_show', 4)]
  const r = totals(data)
  assert.equal(r.occupied_ms, 3 * H); assert.equal(r.booking_count, 3); assert.equal(r.unusual_status_count, 2)
})
test('capacity plan: appointments use saved start and end, independent of service composition', () => {
  const data = input(); data.employees[0].appointments = [{ ...booking('09:00', '11:00'), service_ids: [1, 2, 3], price_cents: 7000 }]
  assert.equal(totals(data).occupied_ms, 2 * H); assert.equal(totals(data).booking_count, 1)
})
test('capacity plan: inactive staff do not add capacity or bookings', () => {
  const data = input(); data.employees[0].active = false
  data.employees[0].appointments = [booking('09:00', '10:00')]
  const r = calculate(data)
  assert.equal(r.active_employee_count, 0); assert.equal(r.totals.booking_count, 0)
})
test('capacity plan: totals use employee-hours and weighted utilization', () => {
  const data = input(); data.employees.push(person(2))
  data.employees[0].appointments = [booking('08:00', '16:00')]
  data.employees[1].working_windows = [interval('08:00', '10:00', 2)]
  const r = totals(data)
  assert.equal(r.capacity_ms, 10 * H); assert.equal(r.occupied_ms, 8 * H); assert.equal(r.utilization_percent, 80)
})
test('capacity plan: interval endpoints are exclusive and already elapsed time is clipped', () => {
  const data = input(); data.as_of = utc('10:00'); data.range.starts_at = utc('10:00')
  data.employees[0].appointments = [booking('09:00', '11:00'), booking('08:00', '10:00', 'confirmed', 2), booking('18:00', '19:00', 'confirmed', 3)]
  const r = totals(data)
  assert.equal(r.capacity_ms, 6 * H); assert.equal(r.occupied_ms, H); assert.equal(r.booking_count, 1)
})
test('capacity plan: fully blocked shifts cannot produce a percentage or negative free time', () => {
  const data = input(); data.employees[0].blocks = [interval('07:00', '17:00')]
  data.employees[0].appointments = [booking('08:00', '09:00')]
  const r = totals(data)
  assert.equal(r.free_ms, 0); assert.equal(r.utilization_percent, null); assert.equal(r.outside_capacity_ms, H)
})
test('capacity plan: UTC intervals preserve spring and autumn elapsed durations', () => {
  for (const [from, to, hours] of [['2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z', 23], ['2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', 25]]) {
    const data = input(); data.as_of = from; data.range = { starts_at: from, ends_at: to }
    data.employees[0].working_windows = [{ ...interval('08:00', '16:00'), ...data.range }]
    assert.equal(totals(data).capacity_ms, hours * H)
  }
})
test('capacity plan: both occurrences of the repeated autumn hour remain distinct', () => {
  const data = input(); data.as_of = '2026-10-25T00:00:00Z'
  data.range = { starts_at: data.as_of, ends_at: '2026-10-25T02:00:00Z' }
  data.employees[0].working_windows = [{ ...interval('08:00', '16:00'), ...data.range }]
  data.employees[0].appointments = [
    { ...booking('08:00', '09:00'), starts_at: '2026-10-25T00:00:00Z', ends_at: '2026-10-25T01:00:00Z' },
    { ...booking('08:00', '09:00', 'confirmed', 2), starts_at: '2026-10-25T01:00:00Z', ends_at: '2026-10-25T02:00:00Z' }]
  const r = totals(data)
  assert.equal(r.occupied_ms, 2 * H); assert.equal(r.overlapping_booking_ms, 0)
})
test('capacity plan: fractional-offset zones and sub-minute durations are retained', () => {
  const data = input(); data.timezone = 'Asia/Kathmandu'
  data.employees[0].appointments = [{ ...booking('08:00', '09:00'), ends_at: '2026-11-17T08:00:30.500Z' }]
  assert.equal(totals(data).occupied_ms, 30500)
})
test('capacity plan: wrong salon or employee is rejected, including inactive records', () => {
  for (const field of ['working_windows', 'blocks', 'appointments']) {
    for (const key of ['salon_id', 'employee_id']) {
      const data = input(); data.employees[0][field] = [{ ...booking('08:00', '09:00'), [key]: 99 }]
      data.employees[0].active = false
      assert.throws(() => calculate(data), { code: 'CAPACITY_INVALID_DATA' })
    }
  }
})
test('capacity plan: duplicate employee or booking identities are not silently counted', () => {
  const data = input(); data.employees.push(person('1')); assert.throws(() => calculate(data))
  data.employees = [person(1), person(2)]
  data.employees[0].appointments = [booking('08:00', '09:00')]
  data.employees[1].appointments = [booking('08:00', '09:00', 'confirmed', '1', 2)]
  assert.throws(() => calculate(data))
})
test('capacity plan: malformed instants dates range timezone and status fail closed', () => {
  for (const starts_at of ['2026-02-30T08:00:00Z', '2026-11-17T08:00:00', '2026-11-17T08:00:00+01:00', '', null, 123]) {
    const data = input(); data.range.starts_at = starts_at; assert.throws(() => calculate(data))
  }
  for (const timezone of [null, '', 'Not/AZone']) { const data = input(); data.timezone = timezone; assert.throws(() => calculate(data)) }
  const data = input(); data.employees[0].appointments = [booking('08:00', '09:00', 'unknown')]; assert.throws(() => calculate(data))
})
test('capacity plan: retrospective excessive and reversed ranges are rejected', () => {
  const data = input(); data.as_of = utc('09:00'); assert.throws(() => calculate(data))
  data.as_of = utc('07:00'); data.range.ends_at = '2027-01-01T00:00:00Z'; assert.throws(() => calculate(data))
  data.range.ends_at = utc('08:00'); assert.throws(() => calculate(data))
})
test('capacity plan: omitted lists invalid identifiers and oversized inputs are rejected', () => {
  for (const field of ['working_windows', 'blocks', 'appointments']) { const data = input(); delete data.employees[0][field]; assert.throws(() => calculate(data)) }
  for (const salon_id of [true, 0, '01', '9007199254740992']) { const data = input(); data.salon_id = salon_id; assert.throws(() => calculate(data)) }
  const data = input(); data.employees = Array(501).fill(person()); assert.throws(() => calculate(data))
  data.employees = [person()]; data.employees[0].blocks = Array(25001).fill(interval('08:00', '09:00')); assert.throws(() => calculate(data))
})
test('capacity plan: input remains unchanged and conservation holds for each employee', () => {
  const data = input(); data.employees[0].blocks = [interval('10:00', '11:00')]
  data.employees[0].appointments = [booking('09:00', '12:00')]
  const before = structuredClone(data), result = calculate(data)
  assert.deepEqual(data, before)
  for (const r of [result.totals, ...result.employees]) {
    assert.equal(r.capacity_ms, r.occupied_ms + r.free_ms)
    assert.equal(r.working_ms, r.blocked_ms + r.capacity_ms)
    assert.ok(r.utilization_percent >= 0 && r.utilization_percent <= 100)
  }
  assert.equal(result.basis, 'current_schedule_plan')
})
