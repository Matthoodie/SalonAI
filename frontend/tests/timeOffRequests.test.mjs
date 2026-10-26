import test from 'node:test'
import assert from 'node:assert/strict'
import { createSalonApiContext } from '../src/api/salonApiContext.js'
import { createTimeOffRequestApi } from '../src/api/timeOffRequestApi.js'
import {
  canCancelRequest, validateCancellationNote,
  validateRequestDraft, formatRequestDate, formatRequestTimestamp,
  requestActions, assertRequestPage, appendRequestPage,
} from '../src/pages/TimeOffRequests/timeOffRequestView.js'

const auth = { user: { id: 1 }, current_salon: { id: 10 }, membership: { id: 100, employee_id: 1000 } }
const row = (extra = {}) => ({ id: 5, salon_id: 10, requester_membership_id: 100,
  requested_by_user_id: 1, employee_id: 1000, status: 'pending', type: 'vacation',
  start_date: '2030-01-09', end_date: '2030-01-10', ...extra })
const draft = { startDate: '2030-01-09', endDate: '2030-01-10', type: 'vacation', note: '' }
const response = (body, status = 200) => ({ ok: status < 400, status, async json() { return body } })

test('dates: leap days and date order are validated', () => {
  assert.equal(validateRequestDraft(draft), '')
  assert.equal(validateRequestDraft({ ...draft, startDate: '2028-02-29', endDate: '2028-02-29' }), '')
  for (const extra of [{ startDate: '2030-02-29' }, { endDate: '2030-01-08' }, { type: 'invalid' }, { note: 'x'.repeat(501) }, { note: '\0' }]) assert.notEqual(validateRequestDraft({ ...draft, ...extra }), '')
})
test('dates: all-day dates are displayed without timezone shifts', () => {
  assert.equal(formatRequestDate('2030-01-09'), '09.01.2030.')
  assert.equal(formatRequestDate('2030-02-30'), '—')
  assert.match(formatRequestTimestamp('2030-01-09T23:30:00Z', 'Europe/Zagreb'), /10/)
})
test('actions: owner of request may withdraw but not review', () => {
  assert.deepEqual(requestActions(row(), 'salon', auth), { withdraw: true, review: false })
})
test('actions: salon scope permits reviewing another employee', () => {
  assert.deepEqual(requestActions(row({ requested_by_user_id: 2, requester_membership_id: 200, employee_id: 2000 }), 'salon', auth), { withdraw: false, review: true })
})
test('actions: self scope cannot review coworker', () => {
  assert.deepEqual(requestActions(row({ requested_by_user_id: 2 }), 'self', auth), { withdraw: false, review: false })
})
test('actions: own employee identity and resolved or foreign rows cannot be reviewed', () => {
  assert.equal(requestActions(row({ requested_by_user_id: 2 }), 'salon', auth).review, false)
  for (const extra of [{ status: 'approved' }, { status: 'rejected' }, { status: 'withdrawn' }, { salon_id: 20 }]) assert.deepEqual(requestActions(row(extra), 'salon', auth), { withdraw: false, review: false })
})
test('pages: foreign salon and coworker data fail closed', () => {
  assert.doesNotThrow(() => assertRequestPage({ requests: [row()], scope: 'self' }, auth))
  assert.throws(() => assertRequestPage({ requests: [row({ salon_id: 20 })], scope: 'salon' }, auth))
  assert.throws(() => assertRequestPage({ requests: [row({ requested_by_user_id: 2 })], scope: 'self' }, auth))
})
test('pages: appending deduplicates and updates existing records', () => {
  const result = appendRequestPage({ requests: [row()], scope: 'self' }, { requests: [row({ status: 'approved' }), row({ id: 4 })], scope: 'self', nextBeforeId: null })
  assert.equal(result.requests.length, 2)
  assert.equal(result.requests[0].status, 'approved')
})
test('pages: scope downgrade discards old salon-wide rows', () => {
  const result = appendRequestPage({ scope: 'salon', requests: [row({ requested_by_user_id: 2 })] }, { scope: 'self', requests: [], nextBeforeId: null })
  assert.deepEqual(result.requests, [])
})
test('API: list keeps status cursor and abort signal', async () => {
  const controller = new AbortController()
  const api = createTimeOffRequestApi({ request: async (path, options) => {
    assert.equal(path, '/api/time-off-requests?status=pending&before_id=20')
    assert.equal(options.signal, controller.signal)
    return response({ data: [row()], meta: { scope: 'self', next_before_id: null } })
  } })
  assert.equal((await api.list({ status: 'pending', beforeId: 20, signal: controller.signal })).requests.length, 1)
})
test('API: submit allowlists body and never sends supplied identity', async () => {
  const api = createTimeOffRequestApi({ request: async (path, options) => {
    assert.equal(path, '/api/time-off-requests')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { start_date: draft.startDate, end_date: draft.endDate, type: 'vacation', note: null })
    return response({ data: row() }, 201)
  } })
  await api.submit({ ...draft, salonId: 20, employee_id: 2, status: 'approved' })
})
test('API: withdrawal posts empty body and checks returned status', async () => {
  const api = createTimeOffRequestApi({ request: async (path, options) => {
    assert.equal(path, '/api/time-off-requests/5/withdraw'); assert.equal(options.body, '{}')
    return response({ data: row({ status: 'withdrawn' }) })
  } })
  assert.equal((await api.withdraw(5)).status, 'withdrawn')
})
test('API: decision sends decision note and verifies linked absence', async () => {
  const api = createTimeOffRequestApi({ request: async (path, options) => {
    assert.equal(path, '/api/time-off-requests/5/decision')
    assert.deepEqual(JSON.parse(options.body), { decision: 'approved', decision_note: 'OK' })
    return response({ data: { request: row({ status: 'approved' }), time_off: { source_request_id: 5 } } })
  } })
  await api.decide(5, 'approved', '  OK  ')
})
test('API: invalid identifiers and decisions never send a request', async () => {
  const api = createTimeOffRequestApi({ request: () => assert.fail('Unexpected request') })
  await assert.rejects(api.withdraw('1e2'))
  await assert.rejects(api.decide(1, 'pending', ''))
  await assert.rejects(api.list({ beforeId: -1 }))
})
test('API: conflict preserves status and translates error', async () => {
  const api = createTimeOffRequestApi({ request: async () => response({ error: { code: 'EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT' } }, 409) })
  await assert.rejects(api.decide(5, 'approved', ''), error => error.statusCode === 409 && error.message.includes('aktivan termin'))
})
test('API: unconfirmed transport failure does not retry mutation', async () => {
  let calls = 0
  const api = createTimeOffRequestApi({ request: async () => { calls++; throw new TypeError('Failed to fetch') } })
  await assert.rejects(api.submit(draft), { code: 'TIME_OFF_NETWORK_ERROR' })
  assert.equal(calls, 1)
})
test('API: malformed responses and wrong decision links fail closed', async () => {
  const api = createTimeOffRequestApi({ request: async () => response({ data: [], meta: { scope: 'all' } }) })
  await assert.rejects(api.list(), { code: 'TIME_OFF_RESPONSE_INVALID' })
  const decisionApi = createTimeOffRequestApi({ request: async () => response({ data: { request: row({ status: 'approved' }), time_off: { source_request_id: 9 } } }) })
  await assert.rejects(decisionApi.decide(5, 'approved', ''), { code: 'TIME_OFF_RESPONSE_INVALID' })
})
test('API: salon context header is attached by existing transport', async () => {
  const context = createSalonApiContext({ fetchImpl: async (_path, options) => {
    assert.equal(options.headers.get('X-Salon-Id'), '10')
    assert.equal(options.cache, 'no-store')
    return new Response(JSON.stringify({ data: [], meta: { scope: 'self', next_before_id: null } }), { status: 200 })
  } })
  context.setSalon(10)
  await createTimeOffRequestApi({ request: context.request }).list()
})
test('API: delayed response from previous salon is rejected', async () => {
  let resolveFetch
  const context = createSalonApiContext({ fetchImpl: () => new Promise(resolve => { resolveFetch = resolve }) })
  context.setSalon(10)
  const pending = createTimeOffRequestApi({ request: context.request }).list()
  context.setSalon(20)
  resolveFetch(new Response(JSON.stringify({ data: [row()], meta: { scope: 'self', next_before_id: null } })))
  await assert.rejects(pending, { code: 'STALE_SALON_CONTEXT' })
})
test('API: changing salon during response body read also rejects stale data', async () => {
  let started
  const reading = new Promise(resolve => { started = resolve })
  let resolveBody
  const context = createSalonApiContext({ fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers(), text: () => { started(); return new Promise(resolve => { resolveBody = resolve }) } }) })
  context.setSalon(10)
  const pending = createTimeOffRequestApi({ request: context.request }).list()
  await reading
  context.setSalon(20)
  resolveBody(JSON.stringify({ data: [row()], meta: { scope: 'self', next_before_id: null } }))
  await assert.rejects(pending, { code: 'STALE_SALON_CONTEXT' })
})

test('cancellation: only salon reviewer of another approved request sees action', () => {
  const approved = row({ status: 'approved', requested_by_user_id: 2, employee_id: 2000 })
  assert.equal(canCancelRequest(approved, 'salon', auth), true)
  for (const [record, scope] of [[approved, 'self'], [row({ status: 'approved' }), 'salon'],
    [{ ...approved, employee_id: 1000 }, 'salon'], [{ ...approved, salon_id: 20 }, 'salon'],
    [{ ...approved, status: 'cancelled' }, 'salon'], [{ ...approved, status: 'pending' }, 'salon']]) {
    assert.equal(canCancelRequest(record, scope, auth), false)
  }
})
test('cancellation: reason is required bounded and rejects NUL', () => {
  assert.equal(validateCancellationNote('  Promjena plana  '), '')
  assert.equal(validateCancellationNote('x'.repeat(500)), '')
  for (const value of ['', ' \n\t ', null, 1, 'x'.repeat(501), 'bad\0']) assert.notEqual(validateCancellationNote(value), '')
})
test('cancellation: history accepts cancelled status without reopening actions', () => {
  const cancelled = row({ status: 'cancelled' })
  assert.doesNotThrow(() => assertRequestPage({ scope: 'self', requests: [cancelled] }, auth))
  assert.deepEqual(requestActions(cancelled, 'salon', auth), { withdraw: false, review: false })
})
test('cancellation: sends trimmed reason and validates audit response', async () => {
  const controller = new AbortController()
  const api = createTimeOffRequestApi({ request: async (path, options) => {
    assert.equal(path, '/api/time-off-requests/5/cancel')
    assert.equal(options.method, 'POST')
    assert.equal(options.signal, controller.signal)
    assert.deepEqual(JSON.parse(options.body), { cancellation_note: 'Promjena' })
    return response({ data: row({ status: 'cancelled', cancelled_at: '2030-01-01T12:00:00Z', cancelled_by_user_id: 2, cancellation_note: 'Promjena' }) })
  } })
  assert.equal((await api.cancel(5, ' Promjena ', { signal: controller.signal })).status, 'cancelled')
})
test('cancellation: invalid reason and id never reach network', async () => {
  const api = createTimeOffRequestApi({ request: () => assert.fail('Unexpected request') })
  for (const reason of ['', '  ', undefined, 'x'.repeat(501), 'bad\0']) await assert.rejects(api.cancel(5, reason))
  await assert.rejects(api.cancel('1e2', 'Promjena'))
})
test('cancellation: approved or unaudited response fails closed', async () => {
  for (const data of [row({ status: 'approved' }), row({ status: 'cancelled' }), null]) {
    const api = createTimeOffRequestApi({ request: async () => response({ data }) })
    await assert.rejects(api.cancel(5, 'Promjena'), { code: 'TIME_OFF_RESPONSE_INVALID' })
  }
})
test('cancellation: filters cancelled records and translates stale state', async () => {
  const api = createTimeOffRequestApi({ request: async path => {
    assert.equal(path, '/api/time-off-requests?status=cancelled')
    return response({ data: [], meta: { scope: 'self', next_before_id: null } })
  } })
  await api.list({ status: 'cancelled' })
  const conflict = createTimeOffRequestApi({ request: async () => response({ error: { code: 'TIME_OFF_REQUEST_NOT_APPROVED' } }, 409) })
  await assert.rejects(conflict.cancel(5, 'Promjena'), error => error.statusCode === 409 && error.message.includes('više nije odobren'))
})
test('cancellation: network failure never retries a destructive action', async () => {
  let calls = 0
  const api = createTimeOffRequestApi({ request: async () => { calls++; throw new TypeError('Offline') } })
  await assert.rejects(api.cancel(5, 'Promjena'), { code: 'TIME_OFF_NETWORK_ERROR' })
  assert.equal(calls, 1)
})
