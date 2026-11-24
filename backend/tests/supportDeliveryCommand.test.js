import test from 'node:test'
import assert from 'node:assert/strict'
import { createSupportClerkContactResolver } from '../src/services/supportClerkContactService.js'
import { supportDeliveryArgs, activationDate, supportDevConnection, deliveryCommandExit } from '../src/utils/supportDeliveryCommand.js'
import { executeSupportDeliveryCommand } from '../src/services/supportDeliveryCommandService.js'
import { createSupportResendTransport } from '../src/services/supportResendTransport.js'

const after = '2026-11-20T00:00:00.000Z'
const email = 'test@example.com'
const options = { mode: 'preview', database: 'salonai_dev', activationAfter: after, eventId: '1', authorId: '2', allowedRecipient: email }
const contact = { subject: 'user_test', email, verified: true }
const user = () => ({ id: 'user_test', banned: false, locked: false, primaryEmailAddressId: 'id1',
  emailAddresses: [{ id: 'id1', emailAddress: email, verification: { status: 'verified' } }],
  privateMetadata: { secret: 'not-for-output' } })
function fixture(patch = {}) {
  const calls = []
  const row = { id: '1', ticket_id: '3', state: 'held', created_at: '2026-11-20T01:00:00Z', language: 'hr',
    active: true, auth_provider: 'clerk', auth_subject: 'user_test', ...patch.row }
  const dbPool = { query: async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('current_database()')) return { rows: [{ name: patch.database ?? 'salonai_dev', now: '2026-11-21T00:00:00Z' }] }
    if (sql.includes('LIMIT 21')) return { rows: patch.events ?? [] }
    return { rows: patch.missing ? [] : [row] }
  } }
  const run = (opts = {}) => executeSupportDeliveryCommand({ options: { ...options, ...opts }, dbPool,
    resolveContact: async () => { calls.push('CONTACT'); return patch.contact ?? contact },
    makeTransport: () => { calls.push('TRANSPORT'); return async () => ({ outcome: 'accepted', providerId: 'mock-id' }) },
    createService: input => { calls.push({ service: input }); return {
      prepare: async () => { calls.push('PREPARE'); return { state: 'ready' } },
      runOne: async () => { calls.push('SEND'); return { state: 'accepted' } },
    } },
  })
  return { run, calls }
}
test('args: no implicit sending or default mode', () => {
  assert.throws(() => supportDeliveryArgs([]))
  assert.deepEqual(supportDeliveryArgs(['--help']), { mode: 'help' })
})
test('args: send requires matching explicit event confirmation', () => {
  const args = ['--send','--database','salonai_dev','--after',after,'--event','1','--author','2','--to',email]
  assert.throws(() => supportDeliveryArgs(args))
  assert.throws(() => supportDeliveryArgs([...args,'--confirm-event','2']))
  assert.equal(supportDeliveryArgs([...args,'--confirm-event','1']).mode,'send')
})
test('args: unknown, duplicate, stray and production arguments fail', () => {
  for (const args of [ ['--start','--database','salonai_prod'], ['--start','--database','salonai_dev','--to',email],
    ['--list','--database','salonai_dev','--database','salonai_dev'], ['--start','--database'],
    ['--send-all','--database','salonai_dev'], ['--start','--database','salonai_dev','--secret','secret'] ]) assert.throws(() => supportDeliveryArgs(args))
})
test('dates: UTC only, real calendar dates, canonical milliseconds', () => {
  assert.equal(activationDate('2026-11-20T00:00:00Z'), after)
  for (const value of ['2026-02-30T00:00:00Z','2026-11-20','2026-11-20T00:00:00+01:00','tomorrow']) assert.throws(() => activationDate(value))
})
test('configuration: explicit DEV only; no database URL override', () => {
  assert.equal(supportDevConnection({ DATABASE_URL: 'postgresql://localhost/salonai_dev' }).max, 2)
  for (const env of [{}, { DATABASE_URL: 'postgresql://localhost/salonai_regression' }, { DATABASE_URL: 'https://localhost/salonai_dev' },
    { DATABASE_URL: 'postgresql://localhost/salonai_dev?database=prod' }, { DATABASE_URL: 'postgresql://localhost/salonai_dev', NODE_ENV: 'production' }]) assert.throws(() => supportDevConnection(env))
})
test('Clerk: minimal current primary contact only, no metadata', async () => {
  const resolve = createSupportClerkContactResolver({ getUser: async () => user() })
  assert.deepEqual(await resolve('user_test'), contact)
})
for (const [label, patch] of Object.entries({ banned: { banned: true }, locked: { locked: true }, deleted: { deleted: true },
  deprovisioned: { deprovisioned: true }, missingFlags: { banned: undefined }, wrongSubject: { id: 'user_other' },
  noPrimary: { primaryEmailAddressId: null }, noEmails: { emailAddresses: [] },
  unverified: { emailAddresses: [{ id: 'id1', emailAddress: email, verification: { status: 'unverified' } }] },
  invalidEmail: { emailAddresses: [{ id: 'id1', emailAddress: 'bad\n@example.com', verification: { status: 'verified' } }] },
  verifiedSecondaryOnly: { emailAddresses: [{ id: 'secondary', emailAddress: email, verification: { status: 'verified' } }] },
})) test('Clerk rejects ' + label, async () => {
  assert.equal(await createSupportClerkContactResolver({ getUser: async () => ({ ...user(), ...patch }) })('user_test'), null)
})
test('Clerk: invalid subject never performs network lookup', async () => {
  let count = 0
  const resolve = createSupportClerkContactResolver({ getUser: async () => { count++; return user() } })
  assert.equal(await resolve('../users'), null); assert.equal(count, 0)
})
test('Clerk: unavailable or timed out never leaks raw provider error', async () => {
  const resolve = createSupportClerkContactResolver({ getUser: async () => { throw Error('sk_test_private EMAIL') } })
  await assert.rejects(resolve('user_test'), e => e.message.includes('unavailable') && !e.message.includes('sk_test'))
  await assert.rejects(createSupportClerkContactResolver({ getUser: () => new Promise(() => {}), timeoutMs: 5 })('user_test'), /unavailable/)
})
test('command: actual DB guard runs before contact, preparation or transport', async () => {
  const f = fixture({ database: 'salonai_prod' })
  await assert.rejects(f.run({ mode: 'send' }), /database/); assert.equal(f.calls.length, 1)
})
test('command: start returns DB timestamp, without mutation/contact/send', async () => {
  const f = fixture(); const result = await f.run({ mode: 'start' })
  assert.equal(result.activation_after,'2026-11-21T00:00:00.000Z'); assert.equal(f.calls.length,1)
})
test('command: list limited to twenty events; no bodies or external calls', async () => {
  const f = fixture({ events: Array.from({ length: 21 }, (_, i) => ({ event_id: String(i + 1) })) })
  const result = await f.run({ mode: 'list' })
  assert.equal(result.events.length,20); assert.equal(result.has_more,true); assert.equal(f.calls.length,2)
  assert.deepEqual(f.calls[1].params,[after]); assert.equal(f.calls[1].sql.includes('body'),false)
})
test('command: status returns delivery metadata without recipient or message', async () => {
  const f = fixture({ row: { recipient: email, subject: 'private', text_body: 'private', state: 'accepted', provider_id: 'abc' } })
  const result = await f.run({ mode: 'status' })
  assert.equal(result.provider_id,'abc'); assert.equal(JSON.stringify(result).includes('private'),false); assert.equal('recipient' in result,false)
  assert.equal(f.calls.includes('CONTACT'),false)
})
test('command: preview uses verified contact, minimal template and no writes', async () => {
  const f = fixture(); const result = await f.run()
  assert.equal(result.recipient_verified,true); assert.match(result.subject,/#3/)
  assert.equal(f.calls.includes('TRANSPORT'),false); assert.equal(f.calls.includes('PREPARE'),false)
  assert.ok(f.calls.filter(x=>x?.sql).every(x=>x.sql.startsWith('SELECT')))
})
test('command: unknown author/event does not leak event details', async () => {
  const f = fixture({ missing: true }); assert.deepEqual(await f.run(),{ state:'missing' }); assert.equal(f.calls.includes('CONTACT'),false)
})
test('command: wrong recipient blocks prepare and send', async () => {
  const f = fixture({ row: { state: 'ready' }, contact: { ...contact, email: 'other@example.com' } })
  assert.equal((await f.run({mode:'send'})).state,'blocked'); assert.equal(f.calls.includes('SEND'),false)
})
for (const [label, row, reason] of [
  ['old event',{ created_at:'2020-01-01T00:00:00Z' },'before_activation'],
  ['changed activation',{ activation_after:'2026-11-19T00:00:00Z' },'activation_mismatch'],
  ['frozen recipient mismatch',{ recipient:'other@example.com' },'recipient_mismatch'],
  ['inactive account',{ active:false },'account_unavailable'],
]) test('command blocks '+label,async()=>{
  const f=fixture({row});assert.equal((await f.run({mode:'send'})).reason,reason);assert.equal(f.calls.includes('TRANSPORT'),false)
})
test('command: future activation rejected',async()=>{
  const f=fixture();await assert.rejects(f.run({activationAfter:'2099-01-01T00:00:00.000Z'}),/future/)
})
test('command: prepare cannot instantiate transport',async()=>{
  const f=fixture();assert.equal((await f.run({mode:'prepare'})).state,'ready');assert.equal(f.calls.includes('TRANSPORT'),false)
  assert.equal(f.calls.find(x=>x?.service).service.send,undefined)
})
test('command: held event cannot be sent without preparation',async()=>{
  const f=fixture();assert.equal((await f.run({mode:'send'})).reason,'not_prepared');assert.equal(f.calls.includes('TRANSPORT'),false)
})
for(const state of ['accepted','rejected','uncertain','suppressed'])test('command: '+state+' never instantiates provider or resends',async()=>{
  const f=fixture({row:{state}});assert.equal((await f.run({mode:'send'})).state,state)
  assert.equal(f.calls.includes('CONTACT'),false);assert.equal(f.calls.includes('TRANSPORT'),false)
})
test('command: ready event passes verified resolver and one transport to B2',async()=>{
  const f=fixture({row:{state:'ready'}});assert.equal((await f.run({mode:'send'})).state,'accepted')
  assert.equal(f.calls.filter(x=>x==='TRANSPORT').length,1);assert.equal(f.calls.filter(x=>x==='SEND').length,1)
})
test('exit codes distinguish blocked and uncertain from accepted',()=>{
  assert.equal(deliveryCommandExit({state:'accepted'}),0)
  assert.equal(deliveryCommandExit({state:'blocked'}),2)
  assert.equal(deliveryCommandExit({state:'held',reason:'not_prepared'}),2)
  assert.equal(deliveryCommandExit({state:'uncertain'}),3)
})
test('integration transport: selected address preserved; no reply content; provider accept sanitized',async()=>{
  let request
  const send=createSupportResendTransport({enabled:true,apiKey:'re_fake',allowedRecipients:[email],fetchImpl:async(url,init)=>{
    request={url,...init};return {status:200,json:async()=>({id:'mock-accepted',extra:'private'})}
  }})
  const result=await send({to:email,subject:'ZRIHTAN',text:'Open your support history.',idempotencyKey:'support-reply/test-frozen-key',body:'PRIVATE REPLY'})
  assert.deepEqual(result,{outcome:'accepted',providerId:'mock-accepted'})
  assert.equal(request.url,'https://api.resend.com/emails');assert.equal(request.body.includes('PRIVATE REPLY'),false)
  assert.deepEqual(JSON.parse(request.body).to,[email])
})
