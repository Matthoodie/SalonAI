import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/database/pool.js'
import { createPetPhotoService } from '../src/services/petPhotoService.js'
after(() => pool.end())
const ctx = { salonId: 1, userId: 2, clientId: 3, petId: 4 }
const image = { bytes: Buffer.from([255,216,255,1]), width: 5, height: 5 }
async function scenario(run, { access = true, ownerActive = true, petActive = true, revision = 1, hasPhoto = false, failCommit = false } = {}) {
  const original = pool.connect, commands = []; let released = 0, updated = 0, decoded = 0
  const row = () => ({ id: 4, client_id: 3, salon_id: 1, revision: revision + updated, photo_version: updated, has_photo: hasPhoto || updated > 0, active: petActive })
  pool.connect = async () => ({ release: () => released++, query: async sql => {
    commands.push(sql)
    if (sql.includes('JOIN salon_memberships')) return { rows: access ? [{}] : [] }
    if (sql.includes('FROM salon_setup')) return { rows: [{ business_type: 'grooming' }] }
    if (sql.includes('FROM clients')) return { rows: [{ active: ownerActive }] }
    if (sql.includes('UPDATE client_pets')) { updated++; return { rows: [] } }
    if (sql.includes('FROM client_pets')) return { rows: [row()] }
    if (failCommit && updated && sql === 'COMMIT') throw Error('commit failed')
    return { rows: [] }
  } })
  const service = createPetPhotoService({ processImage: async () => { decoded++; return image } })
  try { await run(service, commands, () => ({ released, updated, decoded })) } finally { pool.connect = original }
}
test('photo transaction: forbidden access stops before decoding or writes', () => scenario(async (s, c, counters) => {
  await assert.rejects(s.upload(ctx, Buffer.from('image'), 1), { code: 'PET_FORBIDDEN' })
  assert.deepEqual(counters(), { released: 1, updated: 0, decoded: 0 }); assert.equal(c.at(-1), 'ROLLBACK')
}, { access: false }))
test('photo transaction: archived owner/pet and stale revision stop before decoding', async () => {
  for (const [state, code] of [[{ ownerActive: false }, 'PET_CLIENT_ARCHIVED'], [{ petActive: false }, 'PET_PHOTO_ARCHIVED'], [{ revision: 2 }, 'PET_VERSION_CONFLICT']]) {
    await scenario(async (s, c, counters) => { await assert.rejects(s.upload(ctx, image.bytes, 1), { code }); assert.equal(counters().decoded, 0) }, state)
  }
})
test('photo transaction: checks access twice, saves once and releases both connections', () => scenario(async (s, c, counters) => {
  const result = await s.upload(ctx, image.bytes, 1)
  assert.equal(result.revision, 2); assert.equal(result.has_photo, true)
  assert.deepEqual(counters(), { released: 2, updated: 1, decoded: 1 })
  assert.equal(c.filter(x => x.includes('JOIN salon_memberships')).length, 2)
}))
test('photo transaction: unconfirmed commit fails without retry and releases connection', () => scenario(async (s, c, counters) => {
  await assert.rejects(s.upload(ctx, image.bytes, 1), /commit failed/)
  assert.equal(counters().updated, 1); assert.equal(counters().released, 2); assert.equal(c.at(-1), 'ROLLBACK')
}, { failCommit: true }))
test('photo transaction: absent image removal is idempotent at current profile revision', () => scenario(async (s, c, counters) => {
  const result = await s.remove(ctx, 1); assert.equal(result.revision, 1); assert.equal(counters().updated, 0)
}))
