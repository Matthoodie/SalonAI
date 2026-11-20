// Called ONLY with the connection already holding the reply transaction.
export async function recordReplyNotification(db, ticketId, messageId) {
  const result = await db.query(`INSERT INTO support_notification_outbox(message_id,language)
    SELECT m.id,t.language FROM support_ticket_messages m
    JOIN support_tickets t ON t.id=m.ticket_id
    WHERE m.id=$1 AND t.id=$2 RETURNING id`, [messageId,ticketId])
  if (result.rowCount !== 1) throw new Error('Support notification event was not recorded.')
  return result.rows[0].id
}
// Internal CLI only. No email, author, subject, description, or reply content selected.
export async function readHeldNotifications(db, before = null) {
  return (await db.query(`SELECT o.id,m.ticket_id,o.message_id,o.event_type,o.language,o.state,o.created_at
    FROM support_notification_outbox o JOIN support_ticket_messages m ON m.id=o.message_id
    WHERE o.state='held' AND ($1::bigint IS NULL OR o.id<$1)
    ORDER BY o.id DESC LIMIT 21`, [before])).rows
}
