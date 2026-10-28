import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAppointmentServiceIds, sumAppointmentServices } from '../src/utils/appointmentServices.js'

test('service selection: legacy single and ordered array normalize to IDs', () => {
  assert.deepEqual(parseAppointmentServiceIds({ service_id: '8' }).data, [8])
  assert.deepEqual(parseAppointmentServiceIds({ service_ids: [9, '8'] }).data, [9, 8])
})
test('service selection: ambiguous single and multiple input is rejected', () => {
  assert.equal(parseAppointmentServiceIds({ service_id: 1, service_ids: [1] }).error.status, 400)
})
test('service selection: empty, missing, scalar and oversized lists rejected', () => {
  for (const value of [[], null, 1, '1,2', Array.from({ length: 21 }, (_, i) => i + 1)]) {
    assert.ok(parseAppointmentServiceIds({ service_ids: value }).error)
  }
  assert.ok(parseAppointmentServiceIds({}).error)
})
test('service selection: invalid IDs cannot be coerced into valid services', () => {
  for (const value of [true, false, null, {}, [], 0, -1, 1.2, '', ' ', '1x', Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(parseAppointmentServiceIds({ service_ids: [1, value] }).error)
  }
})
test('service selection: numeric/string duplicates rejected', () => {
  assert.ok(parseAppointmentServiceIds({ service_ids: [1, '1'] }).error)
})
test('service selection: max size accepted and input not mutated', () => {
  const ids = Array.from({ length: 20 }, (_, i) => String(i + 1))
  assert.equal(parseAppointmentServiceIds({ service_ids: ids }).data.length, 20)
  assert.equal(ids[0], '1')
})
test('totals: exact integer cents, zero price and one minute accepted', () => {
  assert.deepEqual(sumAppointmentServices([
    { price_cents: 1800, duration_minutes: 20 },
    { price_cents: 1800, duration_minutes: 30 },
    { price_cents: 0, duration_minutes: 1 },
  ]).data, { price_cents: 3600, duration_minutes: 51 })
})
test('totals: PostgreSQL integer overflow rejected', () => {
  assert.ok(sumAppointmentServices([
    { price_cents: 2147483647, duration_minutes: 1 },
    { price_cents: 1, duration_minutes: 1 },
  ]).error)
  assert.ok(sumAppointmentServices([
    { price_cents: 0, duration_minutes: 2147483647 },
    { price_cents: 0, duration_minutes: 1 },
  ]).error)
})
test('totals: invalid snapshots cannot silently enter totals', () => {
  for (const item of [
    { price_cents: -1, duration_minutes: 1 },
    { price_cents: 1.5, duration_minutes: 1 },
    { price_cents: 1, duration_minutes: 0 },
    { price_cents: 1, duration_minutes: NaN },
  ]) assert.throws(() => sumAppointmentServices([item]))
})
