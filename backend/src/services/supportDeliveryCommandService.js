import { createSupportDeliveryService } from './supportDeliveryService.js'
import { contactMatches } from '../utils/supportDelivery.js'
import { replyNotificationPreview } from '../utils/supportNotification.js'

export async function readSupportDeliveryEvent(db, eventId, authorId) {
  return (await db.query(`SELECT o.id,o.state,o.created_at,m.ticket_id,t.user_id,
    o.language,u.active,u.auth_provider,u.auth_subject,d.recipient,d.activation_after,
    d.subject,d.text_body,d.attempt_count,d.last_outcome,d.provider_id,d.next_attempt_at
    FROM support_notification_outbox o JOIN support_ticket_messages m ON m.id=o.message_id
    JOIN support_tickets t ON t.id=m.ticket_id JOIN users u ON u.id=t.user_id
    LEFT JOIN support_notification_delivery d ON d.event_id=o.id
    WHERE o.id=$1 AND t.user_id=$2`, [eventId, authorId])).rows[0] ?? null
}

// Administrative local CLI only: possession of DEV database credentials is required.
// Never mount this function as an HTTP route; authorId is not an authentication claim.
export async function executeSupportDeliveryCommand({ options, dbPool, resolveContact, makeTransport,
  createService = createSupportDeliveryService } = {}) {
  const o = options
  const info = (await dbPool.query('SELECT current_database() AS name,clock_timestamp() AS now')).rows[0]
  if (o.database !== 'salonai_dev' || info?.name !== o.database) throw new Error('Actual database does not match salonai_dev.')
  if (o.mode === 'start') return { database: info.name, activation_after: new Date(info.now).toISOString(), sending_enabled: false }
  if (o.activationAfter && new Date(o.activationAfter) > new Date(info.now)) throw new Error('Activation cannot be in the future.')
  if (o.mode === 'list') {
    const rows = (await dbPool.query(`SELECT o.id AS event_id,m.ticket_id,t.user_id AS author_id,o.state,o.created_at
      FROM support_notification_outbox o JOIN support_ticket_messages m ON m.id=o.message_id
      JOIN support_tickets t ON t.id=m.ticket_id WHERE o.created_at >= $1 ORDER BY o.id DESC LIMIT 21`, [o.activationAfter])).rows
    return { events: rows.slice(0, 20), has_more: rows.length > 20, sending_enabled: false }
  }
  const row = await readSupportDeliveryEvent(dbPool, o.eventId, o.authorId)
  if (!row) return { state: 'missing' }
  const status = { event_id: String(row.id), ticket_id: String(row.ticket_id), state: row.state,
    attempt_count: row.attempt_count ?? 0, last_outcome: row.last_outcome ?? null,
    provider_id: row.provider_id ?? null, next_attempt_at: row.next_attempt_at ?? null }
  if (o.mode === 'status') return status
  if (new Date(row.created_at) < new Date(o.activationAfter)) return { state: 'blocked', reason: 'before_activation' }
  if (row.activation_after && new Date(row.activation_after).toISOString() !== o.activationAfter) return { state: 'blocked', reason: 'activation_mismatch' }
  if (row.recipient && row.recipient !== o.allowedRecipient) return { state: 'blocked', reason: 'recipient_mismatch' }
  if (!row.active || row.auth_provider !== 'clerk') return { state: 'blocked', reason: 'account_unavailable' }
  // A replay is a status read. No provider lookup or outbound request for terminal states.
  if (o.mode !== 'preview' && ['accepted', 'rejected', 'uncertain', 'suppressed'].includes(row.state)) return status
  if (o.mode === 'send' && row.state === 'held') return { state: 'held', reason: 'not_prepared' }
  const contact = await resolveContact(row.auth_subject)
  if (!contactMatches(contact, row.auth_subject, o.allowedRecipient)) return { state: 'blocked', reason: 'contact_not_verified' }
  if (o.mode === 'preview') {
    const message = row.subject ? { subject: row.subject, text: row.text_body } : replyNotificationPreview(row.ticket_id, row.language)
    return { ...status, recipient_verified: true, sending_enabled: false, activation_after: o.activationAfter, ...message }
  }
  // B2 rechecks the account and contact, then commits the claim before external I/O.
  const send = o.mode === 'send' ? makeTransport(o.allowedRecipient) : undefined
  const service = createService({ enabled: true, dbPool, resolveVerifiedContact: resolveContact, send })
  return o.mode === 'prepare' ? service.prepare(o) : service.runOne(o)
}
