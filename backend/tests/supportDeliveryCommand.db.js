import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pool from '../src/database/pool.js'
import { createSupportTicketService } from '../src/services/supportTicketService.js'
import { recordReplyNotification } from '../src/repositories/supportNotificationRepository.js'
import { executeSupportDeliveryCommand, readSupportDeliveryEvent } from '../src/services/supportDeliveryCommandService.js'
import { createSupportClerkContactResolver } from '../src/services/supportClerkContactService.js'
import { createSupportResendTransport } from '../src/services/supportResendTransport.js'

after(() => pool.end())
async function fixture(run) {
  const name = (await pool.query('SELECT current_database() AS name')).rows[0].name
  assert.ok(name === 'salonai_regression' || /(^|[_-])test([_-]|$)/i.test(name), 'TEST database required')
  const user = (await pool.query("INSERT INTO users(auth_provider,auth_subject,email) VALUES('clerk',$1,$2) RETURNING *",
    ['user_integration' + randomUUID().replaceAll('-', ''), randomUUID() + '@example.test'])).rows[0]
  try {
    const ticket = (await createSupportTicketService().create(user.id, { request_id: randomUUID(), category: 'help',
      subject: 'Synthetic integration ticket', description: 'Synthetic isolated support command integration test.', language: 'hr' })).ticket
    const message = (await pool.query("INSERT INTO support_ticket_messages(ticket_id,operator_user_id,body) VALUES($1,$2,'PRIVATE REPLY CONTENT') RETURNING id", [ticket.id,user.id])).rows[0]
    const eventId = String(await recordReplyNotification(pool, ticket.id, message.id))
    const options = { database: 'salonai_dev', eventId, authorId: String(user.id), allowedRecipient: user.email, activationAfter: '2020-01-01T00:00:00.000Z' }
    const payloads = []
    let verified = true, outcome = 'accepted'
    // Test-only adapter: underlying database was checked above; all SQL remains on TEST.
    // Simulate the CLI's expected DEV name; production CLI has no override/injection flag.
    const dbPool = { connect: () => pool.connect(), query: async (sql, params) => {
      const result = await pool.query(sql, params)
      if (sql === 'SELECT current_database() AS name,clock_timestamp() AS now') return { rows: [{ ...result.rows[0], name: 'salonai_dev' }] }
      return result
    } }
    const resolveContact = createSupportClerkContactResolver({ getUser: async id => ({ id, banned: false, locked: false,
      primaryEmailAddressId: 'primary', emailAddresses: [{ id: 'primary', emailAddress: user.email, verification: { status: verified ? 'verified' : 'unverified' } }] }) })
    const command = (mode, patch = {}) => executeSupportDeliveryCommand({ options: { ...options, mode, ...patch }, dbPool, resolveContact,
      makeTransport: recipient => createSupportResendTransport({ enabled: true, apiKey: 're_fake', allowedRecipients: [recipient],
        fetchImpl: async (url, init) => { payloads.push({ url, ...init }); if (outcome === 'unknown') throw Error('synthetic timeout'); return { status: 200, json: async () => ({ id: 'fake-delivery-id' }) } } }),
    })
    await run({ user, eventId, options, command, payloads, setVerified: v => { verified = v }, setOutcome: v => { outcome = v },
      read: () => readSupportDeliveryEvent(pool,eventId,String(user.id)),
      snapshot: async () => (await pool.query('SELECT * FROM support_notification_delivery WHERE event_id=$1',[eventId])).rows[0],
    })
  } finally { await pool.query('DELETE FROM support_tickets WHERE user_id=$1',[user.id]); await pool.query('DELETE FROM users WHERE id=$1',[user.id]) }
}
test('command DB: preview is read-only; correct owner required', () => fixture(async f => {
  assert.equal((await f.command('preview')).recipient_verified,true)
  assert.equal(await f.snapshot(),undefined);assert.equal(f.payloads.length,0)
  assert.deepEqual(await f.command('status',{authorId:'9007199254740991'}),{state:'missing'})
}))
test('command DB: full prepare/send/replay through real B2 and B1 sends once', () => fixture(async f => {
  assert.equal((await f.command('prepare')).state,'ready');assert.equal(f.payloads.length,0)
  assert.equal((await f.command('send')).state,'accepted');assert.equal((await f.command('send')).state,'accepted')
  assert.equal(f.payloads.length,1)
  const body=JSON.parse(f.payloads[0].body)
  assert.deepEqual(body.to,[f.user.email]);assert.equal(body.text.includes('PRIVATE REPLY'),false)
  const snapshot=await f.snapshot()
  assert.equal(f.payloads[0].headers['Idempotency-Key'],'support-reply/'+snapshot.idempotency_key)
  const status=await f.command('status');assert.equal(status.attempt_count,1);assert.equal(status.provider_id,'fake-delivery-id')
}))
test('command DB: unverified primary blocks prepared delivery without attempt', () => fixture(async f => {
  await f.command('prepare');f.setVerified(false)
  assert.equal((await f.command('send')).state,'blocked');assert.equal(f.payloads.length,0)
  assert.equal((await f.snapshot()).attempt_count,0)
}))
test('command DB: unknown provider outcome cannot resend', () => fixture(async f => {
  await f.command('prepare');f.setOutcome('unknown')
  assert.equal((await f.command('send')).state,'uncertain');await f.command('send');assert.equal(f.payloads.length,1)
}))
test('command DB: activation boundary and frozen recipient cannot change', () => fixture(async f => {
  await f.command('prepare')
  assert.equal((await f.command('send',{activationAfter:'2021-01-01T00:00:00.000Z'})).reason,'activation_mismatch')
  assert.equal((await f.command('send',{allowedRecipient:'other@example.test'})).reason,'recipient_mismatch')
  assert.equal(f.payloads.length,0);assert.equal((await f.snapshot()).attempt_count,0)
}))
test('command DB: concurrent commands still result in one outbound request', () => fixture(async f => {
  await f.command('prepare');await Promise.all([f.command('send'),f.command('send')])
  assert.equal(f.payloads.length,1);assert.equal((await f.read()).state,'accepted')
}))
