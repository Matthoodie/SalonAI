import test from 'node:test'
import assert from 'node:assert/strict'
import { blockedLocalTimeToUtc } from '../src/api/blockedTimeDateTime.js'
import { requestDraftToPayload, assertRequestPage, canCancelRequest, requestActions } from '../src/pages/BlockedTimeRequests/blockedTimeRequestView.js'
import { createBlockedTimeRequestApi } from '../src/api/blockedTimeRequestApi.js'
import { mapEmployeeToFrontend, mapEmployeeToCreatePayload } from '../src/api/employeeMapper.js'
import { createSalonApiContext } from '../src/api/salonApiContext.js'
const auth = { user: { id: 1 }, current_salon: { id: 10 }, membership: { id: 100, employee_id: 1000 } }
const row = extra => ({ id: 5, salon_id: 10, requested_by_user_id: 1, requester_membership_id: 100,
  employee_id: 1000, status: 'pending', type: 'PRIVATE', starts_at: '2030-01-09T09:00:00.000Z', ends_at: '2030-01-09T09:30:00.000Z', ...extra })
const draft = { date: '2030-01-09', startTime: '10:00', endTime: '10:30', type: 'PRIVATE', note: 'Exit' }
const response = (body, status = 200) => ({ ok: status < 400, status, async json() { return body } })

test('blocked UI: winter and summer times follow salon zone', () => {
  assert.equal(blockedLocalTimeToUtc('2030-01-09', '10:00', 'Europe/Zagreb'), '2030-01-09T09:00:00.000Z')
  assert.equal(blockedLocalTimeToUtc('2030-07-09', '10:00', 'Europe/Zagreb'), '2030-07-09T08:00:00.000Z')
})
test('blocked UI: fractional timezone offsets are supported', () => {
  assert.equal(blockedLocalTimeToUtc('2030-01-09', '10:00', 'Asia/Kathmandu'), '2030-01-09T04:15:00.000Z')
})
test('blocked UI: nonexistent spring hour is rejected', () => {
  assert.throws(() => blockedLocalTimeToUtc('2026-03-29', '02:30', 'Europe/Zagreb'), /ne postoji/)
})
test('blocked UI: repeated autumn hour is rejected rather than silently chosen', () => {
  assert.throws(() => blockedLocalTimeToUtc('2026-10-25', '02:30', 'Europe/Zagreb'), /ponavlja/)
})
test('blocked UI: valid hours on either side of DST are accepted', () => {
  assert.equal(blockedLocalTimeToUtc('2026-03-29', '01:30', 'Europe/Zagreb'), '2026-03-29T00:30:00.000Z')
  assert.equal(blockedLocalTimeToUtc('2026-03-29', '03:30', 'Europe/Zagreb'), '2026-03-29T01:30:00.000Z')
})
test('blocked UI: impossible dates and invalid local times are rejected', () => {
  for (const [date, time] of [['2030-02-30', '10:00'], ['2030-01-09', '24:00'], ['bad', '10:00'], ['2030-01-09', '10:60']]) {
    assert.throws(() => blockedLocalTimeToUtc(date, time, 'Europe/Zagreb'))
  }
})
test('blocked UI: draft yields UTC range without identity fields', () => {
  assert.deepEqual(requestDraftToPayload({ ...draft, employee_id: 7 }, 'Europe/Zagreb'), {
    startsAt: row().starts_at, endsAt: row().ends_at, type: 'PRIVATE', note: 'Exit',
  })
})
test('blocked UI: invalid range and long notes are rejected', () => {
  for (const extra of [{ endTime: '10:00' }, { endTime: '09:00' }, { note: 'x'.repeat(251) }, { type: 'vacation' }, { note: '\0' }]) {
    assert.throws(() => requestDraftToPayload({ ...draft, ...extra }, 'Europe/Zagreb'))
  }
})
test('blocked UI: own pending may withdraw but never review', () => {
  assert.deepEqual(requestActions(row(), 'salon', auth), { withdraw: true, review: false })
  assert.equal(canCancelRequest(row({ status: 'approved' }), 'salon', auth), false)
  assert.equal(canCancelRequest(row({ status: 'approved', requested_by_user_id: 2, employee_id: 2000 }), 'salon', auth), true)
})
test('blocked UI: wrong scope invalid intervals and foreign records fail closed', () => {
  assert.doesNotThrow(() => assertRequestPage({ scope: 'self', requests: [row({ status: 'cancelled' })] }, auth))
  for (const extra of [{ salon_id: 20 }, { requested_by_user_id: 2 }, { ends_at: 'invalid' }, { ends_at: row().starts_at }, { type: 'vacation' }]) {
    assert.throws(() => assertRequestPage({ scope: 'self', requests: [row(extra)] }, auth))
  }
})
test('blocked API: submit posts only UTC interval type and note', async () => {
  const api = createBlockedTimeRequestApi({ request: async (path, opts) => {
    assert.equal(path, '/api/blocked-time-requests'); assert.equal(opts.method, 'POST')
    assert.deepEqual(JSON.parse(opts.body), { starts_at: row().starts_at, ends_at: row().ends_at, type: 'PRIVATE', note: 'Exit' })
    return response({ data: row() }, 201)
  } })
  await api.submit({ ...requestDraftToPayload(draft, 'Europe/Zagreb'), salonId: 20 })
})
test('blocked API: approved response must include linked block', async () => {
  const good = createBlockedTimeRequestApi({ request: async () => response({ data: { request: row({ status: 'approved' }), blocked_time: { source_request_id: 5 } } }) })
  await good.decide(5, 'approved', '')
  const bad = createBlockedTimeRequestApi({ request: async () => response({ data: { request: row({ status: 'approved' }), blocked_time: { source_request_id: 6 } } }) })
  await assert.rejects(bad.decide(5, 'approved', ''), { code: 'BLOCKED_TIME_RESPONSE_INVALID' })
})
test('blocked API: cancellation checks audit and reason', async () => {
  const api = createBlockedTimeRequestApi({ request: async (path, opts) => {
    assert.equal(path, '/api/blocked-time-requests/5/cancel')
    assert.deepEqual(JSON.parse(opts.body), { cancellation_note: 'Changed' })
    return response({ data: row({ status: 'cancelled', cancelled_at: '2030-01-01T00:00:00Z', cancelled_by_user_id: 2, cancellation_note: 'Changed' }) })
  } })
  await api.cancel(5, ' Changed ')
  await assert.rejects(api.cancel(5, ' '))
})
test('blocked API: conflicts preserve HTTP status and readable reason', async () => {
  const api = createBlockedTimeRequestApi({ request: async () => response({ error: { code: 'EMPLOYEE_BLOCKED_TIME_APPOINTMENT_CONFLICT' } }, 409) })
  await assert.rejects(api.decide(5, 'approved', ''), error => error.statusCode === 409 && error.message.includes('aktivan termin'))
})
test('blocked API: uncertain writes are never retried automatically', async () => {
  let calls = 0
  const api = createBlockedTimeRequestApi({ request: async () => { calls++; throw new TypeError('Offline') } })
  await assert.rejects(api.cancel(5, 'Changed'), { code: 'BLOCKED_TIME_NETWORK_ERROR' }); assert.equal(calls, 1)
})
test('blocked API: changing salon rejects stale mutation response', async () => {
  let resolveFetch
  const context = createSalonApiContext({ fetchImpl: () => new Promise(resolve => { resolveFetch = resolve }) })
  context.setSalon(10)
  const pending = createBlockedTimeRequestApi({ request: context.request }).withdraw(5)
  context.setSalon(20)
  resolveFetch(new Response(JSON.stringify({ data: row({ status: 'withdrawn' }) })))
  await assert.rejects(pending, { code: 'STALE_SALON_CONTEXT' })
})
test('blocked mapper: protected repeated-hour interval preserves source id and exact UTC', () => {
  const backend = { id: 1, name: 'Test', blocked_times: [{ id: 7, source_request_id: 9,
    starts_at: '2026-10-25T00:30:00.000Z', ends_at: '2026-10-25T01:30:00.000Z', type: 'PRIVATE', reason: 'Approved' }] }
  const mapped = mapEmployeeToFrontend(backend, 'Europe/Zagreb')
  assert.equal(mapped.blockedTimes[0].startTime, mapped.blockedTimes[0].endTime)
  const payload = mapEmployeeToCreatePayload(mapped, 'Europe/Zagreb').blocked_times[0]
  assert.deepEqual(payload, backend.blocked_times[0])
})
test('blocked mapper: multi-day approved block retains end date and exact UTC', () => {
  const backend = { id: 1, blocked_times: [{ id: 7, source_request_id: 9,
    starts_at: '2030-01-09T22:00:00.000Z', ends_at: '2030-01-10T02:00:00.000Z', type: 'OTHER', reason: null }] }
  const mapped = mapEmployeeToFrontend(backend, 'Europe/Zagreb')
  assert.equal(mapped.blockedTimes[0].endDate, '2030-01-10')
  assert.deepEqual(mapEmployeeToCreatePayload(mapped, 'Europe/Zagreb').blocked_times[0], backend.blocked_times[0])
})
test('blocked mapper: manual block remains editable without source identity', () => {
  const mapped = mapEmployeeToFrontend({ id: 1, blocked_times: [{ id: 7, starts_at: row().starts_at, ends_at: row().ends_at, type: 'BREAK', reason: null }] }, 'Europe/Zagreb')
  const payload = mapEmployeeToCreatePayload(mapped, 'Europe/Zagreb').blocked_times[0]
  assert.equal(payload.starts_at, row().starts_at)
  assert.equal(Object.hasOwn(payload, 'source_request_id'), false)
})

test('blocked UI: missing salon timezone never falls back to browser timezone', () => {
  assert.throws(() => blockedLocalTimeToUtc('2030-01-09', '10:00', undefined), /Vremenska zona/)
})
