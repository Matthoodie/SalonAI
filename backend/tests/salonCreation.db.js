import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pool from '../src/database/pool.js'
import { createSalonCreationService } from '../src/services/salonCreationService.js'
import { getSalonSetup, updateSalonSetup } from '../src/services/salonSetupService.js'
import { getAvailableSalonContexts } from '../src/services/currentSalonService.js'
import { createSalonOnboardingRouter } from '../src/routes/salonOnboardingRoutes.js'
import { createApp } from '../src/createApp.js'
after(() => pool.end())
const body = extra => ({ request_id: randomUUID(), name: 'Creation test ' + randomUUID(), timezone: 'Europe/Zagreb', business_type: 'hair', location: 'Pula', ...extra })
async function fixture(run) {
  const users = [], subjects = [], manualSalons = []
  try {
    for (let i = 0; i < 2; i++) {
      const subject = 'user_' + randomUUID().replaceAll('-', '')
      subjects.push(subject)
      users.push(Number((await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id", [subject, subject + '@example.test'])).rows[0].id))
    }
    const environment = { SALON_CREATION_MODE: 'allowlist', SALON_CREATION_ALLOWED_SUBJECTS: subjects.join(',') }
    const service = createSalonCreationService({ environment })
    const addLegacy = async (userId = users[0], active = true) => {
      const sid = Number((await pool.query("INSERT INTO salons(name,timezone) VALUES ('Legacy creation test','Europe/Zagreb') RETURNING id")).rows[0].id)
      manualSalons.push(sid)
      await pool.query("INSERT INTO salon_memberships(user_id,salon_id,role,active) VALUES ($1,$2,'owner',$3)", [userId, sid, active])
      return sid
    }
    await run({ users, subjects, environment, service, addLegacy })
  } finally {
    if (users.length) {
      const ids = (await pool.query('SELECT salon_id FROM salon_creation_receipts WHERE user_id=ANY($1::bigint[]) AND salon_id IS NOT NULL', [users])).rows.map(r => r.salon_id)
      for (const id of [...ids, ...manualSalons]) await pool.query('DELETE FROM salons WHERE id=$1', [id])
      await pool.query('DELETE FROM users WHERE id=ANY($1::bigint[])', [users])
    }
  }
}
const salonCount = async name => Number((await pool.query('SELECT count(*) FROM salons WHERE name=$1', [name])).rows[0].count)

test('creation DB: disabled and nonallowlisted accounts cannot create salons', () => fixture(async f => {
  const draft = body(), disabled = createSalonCreationService({ environment: {} })
  assert.equal((await disabled.eligibility(f.users[0])).can_create, false)
  await assert.rejects(disabled.create(f.users[0], draft), { code: 'SALON_CREATION_DISABLED' })
  const denied = createSalonCreationService({ environment: { ...f.environment, SALON_CREATION_ALLOWED_SUBJECTS: 'user_Other' } })
  await assert.rejects(denied.create(f.users[0], draft), { code: 'SALON_CREATION_FORBIDDEN' })
  assert.equal(await salonCount(draft.name), 0)
}))
test('creation DB: transaction creates active owner, initial draft and in-progress onboarding', () => fixture(async f => {
  assert.deepEqual(await f.service.eligibility(f.users[0]), { can_create: true, reason: null })
  const draft = body({ business_type: 'grooming' }), result = await f.service.create(f.users[0], draft)
  assert.equal(result.replayed, false)
  const contexts = await getAvailableSalonContexts(f.users[0])
  assert.equal(contexts.length, 1); assert.equal(contexts[0].membership.role, 'owner'); assert.equal(contexts[0].membership.active, true)
  assert.equal(contexts[0].membership.employeeId, null); assert.equal(Number(contexts[0].salon.id), Number(result.salon_id))
  const setup = await getSalonSetup({ userId: f.users[0], salonId: result.salon_id })
  assert.equal(setup.salon.name, draft.name); assert.equal(setup.setup.business_type, 'grooming')
  assert.equal(setup.setup.location, 'Pula'); assert.equal(setup.setup.revision, 1); assert.equal(setup.setup.last_step, 'team')
  assert.equal(setup.setup.team_mode, null); assert.equal(setup.setup.owner_provides_services, null)
  assert.deepEqual(await f.service.status(f.users[0], result.salon_id), { salon_id: result.salon_id, status: 'in_progress', requires_setup: true })
  assert.equal((await f.service.eligibility(f.users[0])).reason, 'already_created')
}))
test('creation DB: exact replay returns original IDs and cannot duplicate salon', () => fixture(async f => {
  const draft = body(), first = await f.service.create(f.users[0], draft)
  const replay = await f.service.create(f.users[0], { ...draft, name: ' ' + draft.name + ' ' })
  assert.deepEqual(replay, { ...first, replayed: true }); assert.equal(await salonCount(draft.name), 1)
}))
test('creation DB: changed payload and new request ID do not create a second salon', () => fixture(async f => {
  const draft = body(); await f.service.create(f.users[0], draft)
  await assert.rejects(f.service.create(f.users[0], { ...draft, name: 'Other name' }), { code: 'SALON_CREATION_REQUEST_CONFLICT' })
  await assert.rejects(f.service.create(f.users[0], { ...draft, request_id: randomUUID() }), { code: 'SALON_CREATION_ALREADY_USED' })
  assert.equal(await salonCount(draft.name), 1)
}))
test('creation DB: simultaneous identical requests produce one creation and one replay', () => fixture(async f => {
  const draft = body(), results = await Promise.all([f.service.create(f.users[0], draft), f.service.create(f.users[0], draft)])
  assert.equal(results.filter(r => r.replayed).length, 1)
  assert.equal(results[0].salon_id, results[1].salon_id); assert.equal(await salonCount(draft.name), 1)
}))
test('creation DB: simultaneous different request IDs have a single winner', () => fixture(async f => {
  const a = body(), b = body()
  const results = await Promise.allSettled([f.service.create(f.users[0], a), f.service.create(f.users[0], b)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'SALON_CREATION_ALREADY_USED')
  assert.equal(await salonCount(a.name) + await salonCount(b.name), 1)
}))
test('creation DB: same request UUID is scoped to authenticated account', () => fixture(async f => {
  const draft = body(), a = await f.service.create(f.users[0], draft), b = await f.service.create(f.users[1], draft)
  assert.notEqual(a.salon_id, b.salon_id)
  await assert.rejects(f.service.status(f.users[1], a.salon_id), { code: 'SALON_ONBOARDING_FORBIDDEN' })
}))
test('creation DB: existing membership blocks self-creation even when inactive', () => fixture(async f => {
  for (let i = 0; i < 2; i++) {
    await f.addLegacy(f.users[i], i === 0)
    assert.equal((await f.service.eligibility(f.users[i])).reason, 'existing_membership')
    await assert.rejects(f.service.create(f.users[i], body()), { code: 'SALON_CREATION_MEMBERSHIP_EXISTS' })
  }
}))
test('creation DB: existing salon and saved optional wizard remain exempt from required onboarding', () => fixture(async f => {
  const sid = await f.addLegacy()
  const initial = await f.service.status(f.users[0], sid)
  assert.deepEqual(initial, { salon_id: String(sid), status: 'not_required', requires_setup: false })
  await updateSalonSetup({ userId: f.users[0], salonId: sid, body: {
    expected_revision: 0, business_type: 'hair', location: '', team_mode: null, owner_provides_services: null, last_step: 'review',
  } })
  assert.deepEqual(await f.service.status(f.users[0], sid), initial)
}))
test('creation DB: saving review cursor never completes a new salon', () => fixture(async f => {
  const created = await f.service.create(f.users[0], body())
  await updateSalonSetup({ userId: f.users[0], salonId: created.salon_id, body: {
    expected_revision: 1, business_type: 'hair', location: '', team_mode: 'solo', owner_provides_services: true, last_step: 'review',
  } })
  assert.equal((await f.service.status(f.users[0], created.salon_id)).requires_setup, true)
}))
test('creation DB: failure midway rolls back salon, membership, draft and receipt', () => fixture(async f => {
  const draft = body()
  const failing = createSalonCreationService({ environment: f.environment, dbPool: { connect: async () => {
    const db = await pool.connect()
    return { query: (sql, args) => {
      if (sql.startsWith('INSERT INTO salon_onboarding')) throw new Error('injected transaction failure')
      return db.query(sql, args)
    }, release: () => db.release() }
  } } })
  await assert.rejects(failing.create(f.users[0], draft), /injected transaction failure/)
  assert.equal(await salonCount(draft.name), 0); assert.equal((await getAvailableSalonContexts(f.users[0])).length, 0)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM salon_creation_receipts WHERE user_id=$1', [f.users[0]])).rows[0].n, 0)
  assert.equal((await f.service.eligibility(f.users[0])).can_create, true)
  assert.equal((await f.service.create(f.users[0], draft)).replayed, false)
}))
test('creation DB: inactive user cannot create, read protected status or replay', () => fixture(async f => {
  const draft = body(), created = await f.service.create(f.users[0], draft)
  await pool.query('UPDATE users SET active=false WHERE id=ANY($1::bigint[])', [f.users])
  await assert.rejects(f.service.create(f.users[1], body()), { code: 'SALON_CREATION_FORBIDDEN' })
  await assert.rejects(f.service.create(f.users[0], draft), { code: 'SALON_CREATION_FORBIDDEN' })
  await assert.rejects(f.service.status(f.users[0], created.salon_id), { code: 'SALON_ONBOARDING_FORBIDDEN' })
}))
test('creation DB: revoked ownership and deleted salon never resurrect access through replay', () => fixture(async f => {
  const draft = body(), created = await f.service.create(f.users[0], draft)
  await pool.query("UPDATE salon_memberships SET role='admin' WHERE id=$1", [created.membership_id])
  await assert.rejects(f.service.create(f.users[0], draft), { code: 'SALON_CREATION_RESULT_UNAVAILABLE' })
  await pool.query('DELETE FROM salons WHERE id=$1', [created.salon_id])
  await assert.rejects(f.service.create(f.users[0], draft), { code: 'SALON_CREATION_RESULT_UNAVAILABLE' })
  await assert.rejects(f.service.create(f.users[0], body()), { code: 'SALON_CREATION_ALREADY_USED' })
  assert.equal((await f.service.eligibility(f.users[0])).reason, 'already_created')
}))
test('creation DB: constraints reject inconsistent onboarding state and duplicate receipt', () => fixture(async f => {
  const draft = body(), created = await f.service.create(f.users[0], draft)
  await assert.rejects(pool.query("UPDATE salon_onboarding SET status='completed' WHERE salon_id=$1", [created.salon_id]), { code: '23514' })
  await assert.rejects(pool.query("UPDATE salon_onboarding SET status='unknown' WHERE salon_id=$1", [created.salon_id]), { code: '23514' })
  await assert.rejects(pool.query(`INSERT INTO salon_creation_receipts(user_id,request_id,request_hash,response)
    SELECT user_id,request_id,request_hash,response FROM salon_creation_receipts WHERE user_id=$1`, [f.users[0]]), { code: '23505' })
}))
test('creation API DB: no salon required, actual stored owner, body spoofing rejected', () => fixture(async f => {
  const router = createSalonOnboardingRouter({ service: f.service,
    authenticate: (req, res, next) => { req.currentUser = { id: f.users[0], active: true }; next() } })
  const server = createApp({ onboardingRouter: router }).listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/salon-onboarding`
  const draft = body(), post = value => fetch(url + '/salons', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Salon-Id': '999999' }, body: JSON.stringify(value) })
  try {
    let r = await fetch(url + '/eligibility'); assert.equal(r.status, 200); assert.equal((await r.json()).data.can_create, true)
    r = await post({ ...draft, user_id: f.users[1] }); assert.equal(r.status, 400)
    r = await post(draft); assert.equal(r.status, 201); assert.equal(r.headers.get('cache-control'), 'no-store')
    const created = (await r.json()).data
    r = await post(draft); assert.equal(r.status, 200); assert.deepEqual((await r.json()).data, { ...created, replayed: true })
    assert.equal((await getAvailableSalonContexts(f.users[1])).length, 0)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}))
test('creation DB: same request ID with concurrent different payloads cannot overwrite winner', () => fixture(async f => {
  const a = body(), b = { ...a, location: 'Zagreb' }
  const results = await Promise.allSettled([f.service.create(f.users[0], a), f.service.create(f.users[0], b)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'SALON_CREATION_REQUEST_CONFLICT')
  assert.equal(await salonCount(a.name), 1)
}))
test('creation DB: inactive salon or membership blocks replay and status', () => fixture(async f => {
  const draft = body(), created = await f.service.create(f.users[0], draft)
  for (const table of ['salons', 'salon_memberships']) {
    const id = table === 'salons' ? created.salon_id : created.membership_id
    await pool.query(`UPDATE ${table} SET active=false WHERE id=$1`, [id])
    await assert.rejects(f.service.create(f.users[0], draft), { code: 'SALON_CREATION_RESULT_UNAVAILABLE' })
    await assert.rejects(f.service.status(f.users[0], created.salon_id), { code: 'SALON_ONBOARDING_FORBIDDEN' })
    await pool.query(`UPDATE ${table} SET active=true WHERE id=$1`, [id])
  }
}))
