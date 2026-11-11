import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createPetPhotoRouter } from '../src/routes/petPhotoRoutes.js'
const bytes = Buffer.from([255,216,255,1])
async function fixture(run, role = 'owner') {
  const calls = [], app = express()
  app.use((req, res, next) => { req.currentUser = { id: 2, active: true }; req.currentSalon = { id: 1, active: true }; req.currentMembership = { userId: 2, salonId: 1, role, active: true }; next() })
  app.use('/api/clients', createPetPhotoRouter({ service: {
    read: async (ctx, version) => { calls.push(['read', ctx, version]); return { bytes, pet: { id: 4, client_id: 3, salon_id: 1, photo_version: 2 } } },
    upload: async (...args) => { calls.push(['upload', ...args]); return { id: 4 } },
    remove: async (...args) => { calls.push(['remove', ...args]); return { id: 4 } },
  } }))
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api/clients/3/pets/4/photo`
  try { await run(base, calls) } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
test('photo API: binary read has private no-store, nosniff and validated scope headers', () => fixture(async (url, calls) => {
  const r = await fetch(url + '?version=2'); assert.equal(r.status, 200)
  assert.equal(r.headers.get('content-type'), 'image/jpeg'); assert.match(r.headers.get('cache-control'), /no-store/)
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(r.headers.get('x-pet-photo-version'), '2')
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes); assert.equal(calls[0][1].salonId, 1)
}))
test('photo API: upload accepts raw bytes and strong If-Match, delete sends revision', () => fixture(async (url, calls) => {
  assert.equal((await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/octet-stream', 'if-match': '"3"' }, body: bytes })).status, 200)
  assert.deepEqual(calls[0][2], bytes); assert.equal(calls[0][3], 3)
  assert.equal((await fetch(url, { method: 'DELETE', headers: { 'if-match': '"4"' } })).status, 200)
  assert.equal(calls[1][2], 4)
}))
test('photo API: rejects malformed IDs, versions, content type and compressed uploads', () => fixture(async (url, calls) => {
  for (const target of [url, url + '?version=0', url + '?version=2&salon_id=99', url.replace('/4/', '/04/') + '?version=2']) assert.equal((await fetch(target)).status, 400)
  for (const headers of [{}, { 'if-match': '*' }, { 'if-match': '"1"', 'content-type': 'image/png' }, { 'if-match': '"1"', 'content-type': 'application/octet-stream', 'content-encoding': 'gzip' }]) {
    const r = await fetch(url, { method: 'PUT', headers, body: bytes }); assert.ok([400,415].includes(r.status))
  }
  assert.equal(calls.length, 0)
}))
test('photo API: oversized upload is 413 and service is never called', () => fixture(async (url, calls) => {
  const r = await fetch(url, { method: 'PUT', headers: { 'if-match': '"1"', 'content-type': 'application/octet-stream' }, body: Buffer.alloc(8 * 1024 * 1024 + 1) })
  assert.equal(r.status, 413); assert.equal(calls.length, 0)
}))
test('photo API: employee cannot download upload or delete', () => fixture(async (url, calls) => {
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await fetch(url + '?version=2', { method })).status, 403)
  assert.equal(calls.length, 0)
}, 'employee'))
