import test from 'node:test'
import assert from 'node:assert/strict'
import { createPetApi, petPayload, petDraftErrors, validatePetRow } from '../src/api/petApi.js'
import { createSalonApiContext } from '../src/api/salonApiContext.js'
const draft = { name: 'Luna', species: 'dog', breed: '', notes: '' }
const row = extra => ({ id: '3', salon_id: '7', client_id: '2', ...draft, active: true, revision: 1, created_at: '2026-11-06T10:00:00Z', updated_at: '2026-11-06T10:00:00Z', ...extra })
const response = (data, status = 200) => ({ ok: status < 300, status, json: async () => ({ data }) })
test('pets UI: required fields, species, limits and controls are validated', () => {
  assert.deepEqual(petDraftErrors(draft), {})
  for (const bad of [{ name: '' }, { name: ' ' }, { species: 'horse' }, { species: 'toString' }, { name: 'a'.repeat(101) }, { breed: 'a'.repeat(151) }, { notes: 'a'.repeat(2001) }, { notes: '\0' }, { name: '\nLuna' }]) assert.ok(Object.keys(petDraftErrors({ ...draft, ...bad })).length)
  assert.deepEqual(petDraftErrors({ ...draft, name: '🐕'.repeat(100), notes: 'Mirna.\nOsjetljiva na sušilo.' }), {})
})
test('pets UI: payload trims and excludes identity activation photo and extra fields', () => {
  assert.deepEqual(petPayload({ ...draft, name: ' Luna ', salon_id: 99, client_id: 99, active: false, photo_url: 'x' }), draft)
  assert.deepEqual(petPayload(draft, 2), { ...draft, expected_revision: 2 })
  for (const rev of [0, -1, 1.5, '2', 2147483647]) assert.throws(() => petPayload(draft, rev))
})
test('pets API: list validates tenant owner duplicates and malformed rows', async () => {
  for (const data of [null, {}, [row({ salon_id: 8 })], [row({ client_id: 9 })], [row(), row()], [row({ active: 'true' })], [row({ revision: 0 })], [row({ name: ' Luna ' })], [row({ updated_at: 'bad' })]]) {
    await assert.rejects(createPetApi({ request: async () => response(data) }).list(7, 2))
  }
  assert.deepEqual(await createPetApi({ request: async () => response([]) }).list(7, 2), [])
  assert.equal(validatePetRow(row({ extra: 'hidden' }), 7, 2).extra, undefined)
})
test('pets API: same names remain distinct and list preserves signal', async () => {
  const signal = new AbortController().signal
  const api = createPetApi({ request: async (url, opts) => { assert.equal(url, '/api/clients/2/pets'); assert.equal(opts.signal, signal); assert.equal(opts.cache, 'no-store'); return response([row(), row({ id: 4 })]) } })
  assert.equal((await api.list(7, 2, signal)).length, 2)
})
test('pets API: create sends allowlisted fields and validates saved values', async () => {
  const api = createPetApi({ request: async (url, opts) => { assert.equal(opts.method, 'POST'); assert.deepEqual(JSON.parse(opts.body), draft); return response(row(), 201) } })
  assert.equal((await api.create(7, 2, { ...draft, active: false })).id, '3')
  for (const bad of [{ name: 'Other' }, { active: false }, { revision: 2 }, { client_id: 8 }]) await assert.rejects(createPetApi({ request: async () => response(row(bad)) }).create(7, 2, draft))
})
test('pets API: update requires revision and validates identity revision and content', async () => {
  const api = createPetApi({ request: async (url, opts) => { assert.equal(url, '/api/clients/2/pets/3'); assert.equal(opts.method, 'PUT'); assert.equal(JSON.parse(opts.body).expected_revision, 1); return response(row({ name: 'Rex', revision: 2 })) } })
  assert.equal((await api.update(7, 2, row(), { ...draft, name: 'Rex' })).name, 'Rex')
  for (const bad of [{ id: 9 }, { revision: 1 }, { active: false }, { name: 'Other' }]) await assert.rejects(createPetApi({ request: async () => response(row({ revision: 2, ...bad })) }).update(7, 2, row(), draft))
})
test('pets API: invalid identifiers and revisions never send requests', async () => {
  let calls = 0; const api = createPetApi({ request: async () => { calls++; return response(row()) } })
  for (const id of [null, true, 0, -1, '02', '1e2', [], {}]) assert.throws(() => api.list(7, id))
  assert.throws(() => api.update(7, 2, { id: 3 }, draft))
  assert.throws(() => api.setActive(7, 2, row(), 'false'))
  assert.equal(calls, 0)
})
test('pets API: archive and reactivation validate exact status and revision', async () => {
  const api = createPetApi({ request: async (url, opts) => { assert.equal(url, '/api/clients/2/pets/3/active'); assert.equal(opts.method, 'PATCH'); assert.deepEqual(JSON.parse(opts.body), { active: false, expected_revision: 1 }); return response(row({ active: false, revision: 2 })) } })
  assert.equal((await api.setActive(7, 2, row(), false)).active, false)
  const archived = row({ active: false, revision: 2 })
  assert.equal((await createPetApi({ request: async () => response(row({ revision: 3 })) }).setActive(7, 2, archived, true)).revision, 3)
  assert.equal((await createPetApi({ request: async () => response(row()) }).setActive(7, 2, row(), true)).revision, 1)
  await assert.rejects(createPetApi({ request: async () => response(row()) }).setActive(7, 2, row(), false))
})
test('pets API: business disabled and conflicts retain structured codes', async () => {
  for (const [status, code] of [[403, 'PET_BUSINESS_DISABLED'], [409, 'PET_VERSION_CONFLICT'], [409, 'PET_CLIENT_ARCHIVED'], [403, 'PET_FORBIDDEN']]) {
    const api = createPetApi({ request: async () => ({ ok: false, status, json: async () => ({ error: { code } }) }) })
    await assert.rejects(api.list(7, 2), { code, statusCode: status })
  }
})
test('pets API: uncertain writes and malformed success are never retried', async () => {
  for (const result of ['network', 'json', 'server', 'bad']) {
    let calls = 0
    const api = createPetApi({ request: async () => { calls++; if (result === 'network') throw Error('network'); if (result === 'json') return { ok: true, json: async () => { throw Error('JSON') } }; return response(result === 'bad' ? {} : null, result === 'server' ? 500 : 200) } })
    await assert.rejects(api.create(7, 2, draft)); assert.equal(calls, 1)
  }
})
test('pets API: salon switch during response body discards old read and mutation', async () => {
  for (const write of [false, true]) {
    let release, started
    const waiting = new Promise(resolve => { started = resolve })
    const context = createSalonApiContext({ fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => { started(); await new Promise(resolve => { release = resolve }); return JSON.stringify({ data: write ? row() : [row()] }) } }) })
    context.setSalon(7); const api = createPetApi({ request: context.request })
    const pending = write ? api.create(7, 2, draft) : api.list(7, 2)
    await waiting; context.setSalon(8); release()
    await assert.rejects(pending, { code: 'STALE_SALON_CONTEXT' })
  }
})
