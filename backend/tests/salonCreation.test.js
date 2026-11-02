import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { validateSalonCreation, salonCreationHash, salonCreationPolicy } from '../src/utils/salonCreationValidation.js'
import { createSalonCreationService } from '../src/services/salonCreationService.js'
import { createSalonOnboardingRouter } from '../src/routes/salonOnboardingRoutes.js'
import { createApp } from '../src/createApp.js'
const body = extra => ({ request_id: randomUUID(), name: 'Salon test', timezone: 'Europe/Zagreb', business_type: 'hair', location: '', ...extra })
const enabled = { SALON_CREATION_MODE: 'allowlist', SALON_CREATION_ALLOWED_SUBJECTS: 'user_Allowed' }

test('creation: disabled by default, unknown/public mode and malformed allowlist fail closed', () => {
  for (const environment of [{}, { SALON_CREATION_MODE: 'public' }, { ...enabled, SALON_CREATION_ALLOWED_SUBJECTS: '' },
    { ...enabled, SALON_CREATION_ALLOWED_SUBJECTS: 'user_Allowed,' }, { ...enabled, SALON_CREATION_ALLOWED_SUBJECTS: 'someone@example.test' }]) {
    assert.equal(salonCreationPolicy(environment).enabled, false)
  }
  assert.deepEqual(salonCreationPolicy({ ...enabled, SALON_CREATION_ALLOWED_SUBJECTS: ' user_Allowed,user_Allowed ' }), { enabled: true, subjects: ['user_Allowed'] })
})
test('creation: canonical values and stable hash exclude transport request ID', () => {
  const a = validateSalonCreation(body({ name: '  Salon test  ', location: ' Zagreb ' }))
  const b = validateSalonCreation(body({ location: 'Zagreb' }))
  assert.equal(a.name, 'Salon test'); assert.equal(salonCreationHash(a), salonCreationHash(b))
  assert.notEqual(salonCreationHash(a), salonCreationHash({ ...a, business_type: 'grooming' }))
})
test('creation: identity, role, activation and completion cannot be supplied', () => {
  for (const key of ['user_id', 'salon_id', 'auth_subject', 'role', 'active', 'completed', 'status']) {
    assert.throws(() => validateSalonCreation(body({ [key]: 'injected' })), { code: 'SALON_CREATION_INVALID' })
  }
  const missing = body(); delete missing.location
  assert.throws(() => validateSalonCreation(missing)); assert.throws(() => validateSalonCreation(null))
})
test('creation: required fields, UUIDv4, Unicode lengths and timezones are validated', () => {
  for (const extra of [{ name: '' }, { name: 'a'.repeat(151) }, { name: 'X\nY' }, { location: 'a'.repeat(251) },
    { location: 'A\0B' }, { timezone: 'Not/AZone' }, { timezone: '+02:00' }, { request_id: '123' }, { business_type: null }, { business_type: 'beauty' }]) {
    assert.throws(() => validateSalonCreation(body(extra)))
  }
  assert.equal(validateSalonCreation(body({ name: '🐾'.repeat(150), business_type: 'grooming', timezone: 'UTC' })).name.length, 300)
})
test('creation: disabled mode and invalid body never connect to database', async () => {
  let calls = 0
  const service = createSalonCreationService({ environment: {}, dbPool: { connect: async () => { calls++; throw new Error('Unexpected DB') } } })
  assert.deepEqual(await service.eligibility(1), { can_create: false, reason: 'disabled' })
  await assert.rejects(service.create(1, body()), { code: 'SALON_CREATION_DISABLED' })
  await assert.rejects(service.create(1, body({ role: 'owner' })), { code: 'SALON_CREATION_INVALID' })
  await assert.rejects(service.create(null, body()), { statusCode: 401 }); assert.equal(calls, 0)
})
test('creation: authoritative user identity rejects inactive or different subject and rolls back', async () => {
  for (const user of [null, { id: 1, active: false, auth_provider: 'clerk', auth_subject: 'user_Allowed' },
    { id: 1, active: true, auth_provider: 'clerk', auth_subject: 'user_Other' }]) {
    const sql = []; let released = false
    const service = createSalonCreationService({ environment: enabled, dbPool: { connect: async () => ({
      query: async q => { sql.push(q); return { rows: q.startsWith('SELECT') && user ? [user] : [] } }, release: () => { released = true },
    }) } })
    await assert.rejects(service.create(1, body()), { code: 'SALON_CREATION_FORBIDDEN' })
    assert.equal(sql.at(-1), 'ROLLBACK'); assert.equal(released, true); assert.equal(sql.includes('COMMIT'), false)
  }
})
test('creation: failure after salon write triggers rollback and always releases client', async () => {
  const sql = []; let released = false
  const service = createSalonCreationService({ environment: enabled, dbPool: { connect: async () => ({
    query: async q => {
      sql.push(q)
      if (q.startsWith('SELECT id, auth_provider')) return { rows: [{ id: 1, active: true, auth_provider: 'clerk', auth_subject: 'user_Allowed' }] }
      if (q.includes('SELECT request_id')) return { rows: [] }
      if (q.includes('SELECT EXISTS')) return { rows: [{ present: q.includes('pg_timezone_names') }] }
      if (q.startsWith('INSERT INTO salons')) return { rows: [{ id: 9 }] }
      if (q.startsWith('INSERT INTO salon_memberships')) throw new Error('simulated write failure')
      return { rows: [] }
    }, release: () => { released = true },
  }) } })
  await assert.rejects(service.create(1, body()), /simulated write failure/)
  assert.equal(sql.at(-1), 'ROLLBACK'); assert.equal(released, true); assert.equal(sql.includes('COMMIT'), false)
})
async function apiTest(router, run) {
  const app = createApp({ onboardingRouter: router }), server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  try { await run(`http://127.0.0.1:${server.address().port}/api/salon-onboarding`) }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
test('creation API: authentication required before creation or eligibility', async () => {
  let called = false
  const router = createSalonOnboardingRouter({ authenticate: (req, res) => res.status(401).json({ error: { code: 'UNAUTHENTICATED' } }),
    service: { create: () => { called = true }, eligibility: () => { called = true } } })
  await apiTest(router, async url => {
    assert.equal((await fetch(url + '/eligibility')).status, 401)
    assert.equal((await fetch(url + '/salons', { method: 'POST' })).status, 401)
  })
  assert.equal(called, false)
})
test('creation API: routes before salon selection, authenticated ID only, no-store and replay codes', async () => {
  let selected = 0, replayed = false
  const router = createSalonOnboardingRouter({ authenticate: (req, res, next) => { req.currentUser = { id: 7, active: true }; next() },
    selectSalon: (req, res, next) => { selected++; req.currentSalon = { id: 9 }; next() },
    service: { eligibility: async id => { assert.equal(id, 7); return { can_create: true, reason: null } },
      create: async id => { assert.equal(id, 7); return { salon_id: 9, membership_id: 10, replayed } },
      status: async (id, sid) => { assert.equal(id, 7); assert.equal(sid, 9); return { salon_id: sid, status: 'in_progress', requires_setup: true } } } })
  await apiTest(router, async url => {
    let r = await fetch(url + '/eligibility'); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store')
    r = await fetch(url + '/salons', { method: 'POST', headers: { 'X-Salon-Id': '999' } }); assert.equal(r.status, 201)
    replayed = true; r = await fetch(url + '/salons', { method: 'POST' }); assert.equal(r.status, 200)
    assert.equal(selected, 0); r = await fetch(url + '/status'); assert.equal(r.status, 200); assert.equal(selected, 1)
  })
})
