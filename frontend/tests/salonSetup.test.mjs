import test from 'node:test'
import assert from 'node:assert/strict'
import { createSalonSetupApi, setupPayload, validateSetupResponse } from '../src/api/salonSetupApi.js'
import { createSalonApiContext } from '../src/api/salonApiContext.js'
const draft = { business_type: null, location: '', team_mode: null, owner_provides_services: null, last_step: 'business' }
function data(revision = 0, values = {}) {
  return { salon: { id: '7', name: 'Salon', timezone: 'Europe/Zagreb' }, started: revision > 0,
    setup: { ...draft, ...values, salon_id: '7', revision, updated_by_user_id: revision ? '8' : null, updated_at: revision ? '2026-11-02T12:00:00.000Z' : null } }
}
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body })
test('setup: unknown choices remain unknown and identity/completion fields are excluded', () => {
  assert.deepEqual(setupPayload({ ...draft, salon_id: 99, completed: true, name: 'Injected' }, 0), { expected_revision: 0, ...draft })
  const result = validateSetupResponse(data(), 7)
  assert.equal(result.started, false); assert.equal(result.setup.owner_provides_services, null)
  assert.equal(result.setup.completed, undefined)
})
test('setup: response cannot cross salons or declare an unstarted revision saved', () => {
  for (const broken of [{ ...data(), salon: { ...data().salon, id: 8 } },
    { ...data(), setup: { ...data().setup, salon_id: 8 } }, { ...data(), started: true },
    data(1, { last_step: 'complete' }), data(1, { team_mode: 'owner' }), data(1, { owner_provides_services: 'true' })]) {
    assert.throws(() => validateSetupResponse(broken, 7))
  }
})
test('setup: location limits use Unicode characters; trimmed location is sent', () => {
  assert.equal(setupPayload({ ...draft, location: '  Zagreb  ' }, 1).location, 'Zagreb')
  assert.equal(setupPayload({ ...draft, location: '🐾'.repeat(250) }, 1).location.length, 500)
  for (const location of ['a'.repeat(251), 'A\nB', 'A\0B', null]) assert.throws(() => setupPayload({ ...draft, location }, 0))
})
test('setup: draft validates enums and revision before sending', async () => {
  let calls = 0
  const api = createSalonSetupApi({ request: async () => { calls++ } })
  for (const revision of [-1, 1.5, '0', 2147483647]) await assert.rejects(api.save(7, draft, revision))
  await assert.rejects(api.save(7, { ...draft, business_type: 'beauty' }, 0))
  await assert.rejects(api.load('7/other')); assert.equal(calls, 0)
})
test('setup: read sends abort signal and validates saved cursor without completion', async () => {
  const controller = new AbortController()
  const api = createSalonSetupApi({ request: async (path, options) => {
    assert.equal(path, '/api/salon-setup'); assert.equal(options.signal, controller.signal)
    return response({ data: data(3, { last_step: 'review' }) })
  } })
  const result = await api.load(7, controller.signal)
  assert.equal(result.setup.last_step, 'review'); assert.equal(result.completed, undefined)
})
test('setup: save allowlists body and verifies server version and values', async () => {
  const next = { ...draft, business_type: 'grooming', location: ' Zagreb ', last_step: 'team' }
  const api = createSalonSetupApi({ request: async (path, options) => {
    assert.equal(options.method, 'PUT'); const body = JSON.parse(options.body)
    assert.deepEqual(body, { ...next, location: 'Zagreb', expected_revision: 2 })
    return response({ data: data(3, { ...next, location: 'Zagreb' }) })
  } })
  assert.equal((await api.save(7, { ...next, user_id: 99 }, 2)).setup.revision, 3)
  for (const bad of [data(2, next), data(4, next), data(3), { ...data(3, next), started: false }]) {
    const broken = createSalonSetupApi({ request: async () => response({ data: bad }) })
    await assert.rejects(broken.save(7, next, 2))
  }
})
test('setup: conflict and forbidden preserve status; requests never retry', async () => {
  for (const [status, code] of [[409, 'SALON_SETUP_VERSION_CONFLICT'], [403, 'SALON_SETUP_FORBIDDEN']]) {
    let calls = 0
    const api = createSalonSetupApi({ request: async () => { calls++; return response({ error: { code } }, status) } })
    await assert.rejects(api.save(7, draft, 0), error => error.statusCode === status && error.code === code)
    assert.equal(calls, 1)
  }
})
test('setup: transport and malformed responses never repeat writes', async () => {
  for (const request of [async () => { throw new Error('network') }, async () => ({ ok: true, json: async () => { throw new Error('json') } })]) {
    let calls = 0
    const api = createSalonSetupApi({ request: async (...args) => { calls++; return request(...args) } })
    await assert.rejects(api.save(7, draft, 0)); assert.equal(calls, 1)
  }
})
test('setup: changing salon during response body read rejects old results', async () => {
  let context
  context = createSalonApiContext({ fetchImpl: async (path, options) => {
    assert.equal(options.headers.get('X-Salon-Id'), '7')
    return { ok: true, status: 200, text: async () => { context.setSalon(8); return JSON.stringify({ data: data() }) } }
  } })
  context.setSalon(7)
  await assert.rejects(createSalonSetupApi({ request: context.request }).load(7), { code: 'STALE_SALON_CONTEXT' })
})
