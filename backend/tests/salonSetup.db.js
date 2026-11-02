import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pool from '../src/database/pool.js'
import { getSalonSetup, updateSalonSetup } from '../src/services/salonSetupService.js'
import { createFixedTenantTestApp } from './helpers/fixedTenantTestApp.js'
after(() => pool.end())
const draft = extra => ({ expected_revision: 0, business_type: 'hair', location: 'Pula', team_mode: 'solo',
  owner_provides_services: true, last_step: 'team', ...extra })
async function fixture(run) {
  const salons = [], users = []
  try {
    const token = randomUUID()
    for (let i = 0; i < 2; i++) {
      users.push(Number((await pool.query(`INSERT INTO users(auth_provider,auth_subject,email)
        VALUES ('clerk',$1,$2) RETURNING id`, [`setup_${token}_${i}`, `setup_${token}_${i}@example.test`])).rows[0].id))
      salons.push(Number((await pool.query("INSERT INTO salons(name,timezone) VALUES ('Wizard test','Europe/Zagreb') RETURNING id")).rows[0].id))
      await pool.query("INSERT INTO salon_memberships(salon_id,user_id,role) VALUES ($1,$2,'owner')", [salons[i], users[i]])
    }
    await run({ salonId: salons[0], userId: users[0], foreignSalonId: salons[1], foreignUserId: users[1] })
  } finally {
    for (const id of salons) await pool.query('DELETE FROM salons WHERE id=$1', [id])
    for (const id of users) await pool.query('DELETE FROM users WHERE id=$1', [id])
  }
}
const update = (f, body = draft()) => updateSalonSetup({ salonId: f.salonId, userId: f.userId, body })
async function count(f) { return Number((await pool.query('SELECT count(*) FROM salon_setup WHERE salon_id=$1', [f.salonId])).rows[0].count) }
test('setup DB: read of existing salon does not enroll it or modify business data', () => fixture(async f => {
  const result = await getSalonSetup(f)
  assert.equal(result.started, false); assert.equal(result.setup.revision, 0)
  assert.equal(result.setup.business_type, null); assert.equal(await count(f), 0)
  assert.equal(result.salon.name, 'Wizard test'); assert.equal(result.salon.timezone, 'Europe/Zagreb')
}))
test('setup DB: save and resume persist choices while leaving salon/employees/services untouched', () => fixture(async f => {
  const saved = await update(f)
  assert.equal(saved.setup.revision, 1); assert.equal(saved.started, true)
  const resumed = await getSalonSetup(f)
  assert.equal(resumed.setup.last_step, 'team'); assert.equal(resumed.setup.location, 'Pula')
  assert.equal(Number(resumed.setup.updated_by_user_id), f.userId)
  const next = await update(f, draft({ expected_revision: 1, business_type: 'grooming', last_step: 'review' }))
  assert.equal(next.setup.revision, 2); assert.equal(next.setup.business_type, 'grooming')
  assert.equal(Object.hasOwn(next, 'completed'), false)
  const unchanged = (await pool.query(`SELECT s.name,s.timezone,
    (SELECT count(*)::int FROM employees WHERE salon_id=s.id) AS employees,
    (SELECT count(*)::int FROM services WHERE salon_id=s.id) AS services
    FROM salons s WHERE s.id=$1`, [f.salonId])).rows[0]
  assert.deepEqual(unchanged, { name: 'Wizard test', timezone: 'Europe/Zagreb', employees: 0, services: 0 })
}))
test('setup DB: stale and repeated save cannot overwrite a newer draft', () => fixture(async f => {
  await update(f)
  await assert.rejects(update(f, draft({ location: 'Stale' })), { code: 'SALON_SETUP_VERSION_CONFLICT' })
  assert.equal((await getSalonSetup(f)).setup.location, 'Pula'); assert.equal(await count(f), 1)
}))
test('setup DB: concurrent first saves have one winner, no duplicated drafts', () => fixture(async f => {
  const results = await Promise.allSettled([update(f), update(f, draft({ location: 'Zagreb' }))])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'SALON_SETUP_VERSION_CONFLICT')
  assert.equal(await count(f), 1); assert.equal((await getSalonSetup(f)).setup.revision, 1)
}))
test('setup DB: bad first version rolls back its placeholder row', () => fixture(async f => {
  await assert.rejects(update(f, draft({ expected_revision: 20 })), { code: 'SALON_SETUP_VERSION_CONFLICT' })
  assert.equal(await count(f), 0)
}))
test('setup DB: foreign owner cannot read or write another salon', () => fixture(async f => {
  await assert.rejects(getSalonSetup({ salonId: f.foreignSalonId, userId: f.userId }), { code: 'SALON_SETUP_FORBIDDEN' })
  await assert.rejects(update({ ...f, userId: f.foreignUserId }), { code: 'SALON_SETUP_FORBIDDEN' })
  assert.equal(await count(f), 0)
}))
test('setup DB: authoritative membership/user/salon state is rechecked', () => fixture(async f => {
  for (const [sql, restore] of [
    ["UPDATE salon_memberships SET role='admin' WHERE salon_id=$1", "UPDATE salon_memberships SET role='owner' WHERE salon_id=$1"],
    ['UPDATE salon_memberships SET active=false WHERE salon_id=$1', 'UPDATE salon_memberships SET active=true WHERE salon_id=$1'],
    ['UPDATE salons SET active=false WHERE id=$1', 'UPDATE salons SET active=true WHERE id=$1'],
  ]) {
    await pool.query(sql, [f.salonId])
    await assert.rejects(update(f), { code: 'SALON_SETUP_FORBIDDEN' })
    await pool.query(restore, [f.salonId])
  }
  await pool.query('UPDATE users SET active=false WHERE id=$1', [f.userId])
  await assert.rejects(getSalonSetup(f), { code: 'SALON_SETUP_FORBIDDEN' })
  assert.equal(await count(f), 0)
}))
test('setup DB: constraints reject unsupported values and missing salon', () => fixture(async f => {
  await update(f)
  for (const [sql, value] of [
    ['UPDATE salon_setup SET business_type=$2 WHERE salon_id=$1', 'beauty'],
    ['UPDATE salon_setup SET team_mode=$2 WHERE salon_id=$1', 'invalid'],
    ['UPDATE salon_setup SET last_step=$2 WHERE salon_id=$1', 'done'],
    ['UPDATE salon_setup SET revision=$2 WHERE salon_id=$1', -1],
  ]) await assert.rejects(pool.query(sql, [f.salonId, value]), { code: '23514' })
  await assert.rejects(pool.query('INSERT INTO salon_setup(salon_id) VALUES (-1)'), { code: '23503' })
}))
test('setup API DB: save/read use selected tenant and no-store, body identity is rejected', () => fixture(async f => {
  const app = createFixedTenantTestApp(f.salonId, { userId: f.userId })
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/salon-setup`
  try {
    let r = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft()) })
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.equal(Number((await r.json()).data.setup.salon_id), f.salonId)
    r = await fetch(url); assert.equal(r.status, 200); assert.equal((await r.json()).data.setup.revision, 1)
    r = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft({ salon_id: f.foreignSalonId })) })
    assert.equal(r.status, 400)
    assert.equal((await getSalonSetup({ salonId: f.foreignSalonId, userId: f.foreignUserId })).started, false)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}))
