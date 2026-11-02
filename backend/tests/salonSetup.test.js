import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSalonSetup, assertSalonSetupContext, SETUP_STEPS } from '../src/utils/salonSetupValidation.js'
import { createApp } from '../src/createApp.js'
const draft = extra => ({ expected_revision: 0, business_type: null, location: '', team_mode: null,
  owner_provides_services: null, last_step: 'business', ...extra })
const context = () => ({ currentUser: { id: 7, active: true }, currentSalon: { id: 9, active: true },
  currentMembership: { userId: 7, salonId: 9, role: 'owner', active: true } })
test('setup: incomplete draft retains unknowns without inventing an industry or staff', () => {
  assert.deepEqual(validateSalonSetup(draft()), draft())
  assert.equal(validateSalonSetup(draft({ location: '  Pula  ' })).location, 'Pula')
})
test('setup: supported activities, nullable team preferences and resume steps', () => {
  for (const business_type of [null, 'hair', 'grooming', 'mixed', 'other'])
    for (const last_step of SETUP_STEPS) assert.equal(validateSalonSetup(draft({ business_type, last_step })).last_step, last_step)
  assert.equal(validateSalonSetup(draft({ team_mode: 'solo', owner_provides_services: false })).owner_provides_services, false)
})
test('setup: unknown fields cannot change salon identity timezone permissions or completion', () => {
  for (const key of ['salon_id', 'user_id', 'role', 'timezone', 'completed', 'name'])
    assert.throws(() => validateSalonSetup({ ...draft(), [key]: 'injected' }), { code: 'SALON_SETUP_INVALID' })
})
test('setup: strict body, version and value validation', () => {
  for (const body of [null, [], {}, 'test', { ...draft(), expected_revision: '0' }, draft({ expected_revision: -1 }),
    draft({ expected_revision: 1.2 }), draft({ expected_revision: 2147483647 }), draft({ business_type: 'beauty' }),
    draft({ team_mode: 'anything' }), draft({ owner_provides_services: 'true' }), draft({ last_step: 'completed' }),
    draft({ location: null }), draft({ location: 'x'.repeat(251) }), draft({ location: 'Pula\u0000' })])
    assert.throws(() => validateSalonSetup(body), { code: 'SALON_SETUP_INVALID' })
  const missing = draft(); delete missing.location
  assert.throws(() => validateSalonSetup(missing), { code: 'SALON_SETUP_INVALID' })
})
test('setup: owner context must match salon/user identity and active flags', () => {
  assert.deepEqual(assertSalonSetupContext(context()), { salonId: 9, userId: 7 })
  const cases = [ {}, { ...context(), currentUser: { id: 7, active: false } },
    { ...context(), currentSalon: { id: 9, active: false } },
    ...[{ role: 'employee' }, { role: 'admin' }, { active: false }, { userId: 8 }, { salonId: 8 }]
      .map(fields => ({ ...context(), currentMembership: { ...context().currentMembership, ...fields } })) ]
  for (const req of cases) assert.throws(() => assertSalonSetupContext(req), { code: 'SALON_SETUP_FORBIDDEN' })
})
test('setup API: employee/admin denied and invalid owner payload rejected before database access', async () => {
  for (const role of ['employee', 'admin', 'owner']) {
    const app = createApp({ privateRouteMiddleware: [(req, res, next) => {
      Object.assign(req, context()); req.currentMembership.role = role; next()
    }] })
    const server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    try {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api/salon-setup`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft(), salon_id: 99 }),
      })
      assert.equal(r.status, role === 'owner' ? 400 : 403)
      if (role === 'owner') assert.equal(r.headers.get('cache-control'), 'no-store')
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  }
})
