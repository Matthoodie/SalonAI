const ticketFields = 'id, salon_id, category, subject, description, language, context, status, revision, created_at, updated_at'
export async function lockOperatorActor(db, id) {
  // Serialize operator writes (including request keys used on different tickets).
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [id])
}
export async function listTickets(db, {cursor, status, limit}) {
  return (await db.query(`SELECT id, salon_id, category, subject, language, status, revision, created_at, updated_at
    FROM support_tickets WHERE ($1::bigint IS NULL OR id<$1) AND ($2::text IS NULL OR status=$2)
    ORDER BY id DESC LIMIT $3`, [cursor,status,limit+1])).rows
}
export async function findTicket(db, ticketId, authorId = null, write = false) {
  return (await db.query(`SELECT ${ticketFields} FROM support_tickets WHERE id=$1
    AND ($2::bigint IS NULL OR user_id=$2) FOR ${write ? 'UPDATE' : 'SHARE'}`, [ticketId,authorId])).rows[0] ?? null
}
export async function listMessages(db, ticketId, {cursor,limit}) {
  // Public conversation intentionally omits operator identifiers and all audit data.
  return (await db.query(`SELECT id, body, created_at FROM support_ticket_messages
    WHERE ticket_id=$1 AND ($2::bigint IS NULL OR id>$2) ORDER BY id ASC LIMIT $3`, [ticketId,cursor,limit+1])).rows
}
export async function findReplay(db, actor, requestId) {
  return (await db.query(`SELECT ticket_id, request_hash, result_revision, result_status, message_id
    FROM support_ticket_operations WHERE operator_user_id=$1 AND request_id=$2`, [actor,requestId])).rows[0] ?? null
}
export async function replyQuota(db, actor) {
  const row = (await db.query(`SELECT count(*)::int AS count FROM support_ticket_messages
    WHERE operator_user_id=$1 AND created_at>clock_timestamp()-interval '1 hour'`, [actor])).rows[0]
  return row.count < 120
}
export async function insertMessage(db, ticketId, actor, body) {
  return (await db.query(`INSERT INTO support_ticket_messages(ticket_id,operator_user_id,body)
    VALUES ($1,$2,$3) RETURNING id`, [ticketId,actor,body])).rows[0].id
}
export async function updateTicket(db, ticketId, status) {
  return (await db.query(`UPDATE support_tickets SET status=$2,revision=revision+1,updated_at=clock_timestamp()
    WHERE id=$1 RETURNING revision,status`, [ticketId,status])).rows[0]
}
export async function insertOperation(db, actor, ticketId, draft, hash, result) {
  await db.query(`INSERT INTO support_ticket_operations(ticket_id,operator_user_id,request_id,request_hash,result_revision,result_status,message_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [ticketId,actor,draft.request_id,hash,result.revision,result.status,result.message_id])
}
export async function audit(db, actor, accessRevision, action, ticket = null, result = null) {
  await db.query(`INSERT INTO support_ticket_audit(operator_user_id,operator_user_id_snapshot,access_revision,ticket_id,ticket_id_snapshot,action,previous_status,new_status,ticket_revision)
    VALUES ($1,$1,$2,$3,$3,$4,$5,$6,$7)`, [actor,accessRevision,ticket?.id ?? null,action,ticket?.status ?? null,result?.status ?? null,result?.revision ?? ticket?.revision ?? null])
}
