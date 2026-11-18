// All reads are scoped by the authenticated author. Salon roles grant no support access.
const fields = 'id, salon_id, category, subject, description, language, context, status, created_at, updated_at'
export async function lockSupportUser(db, userId, write = false) {
  return (await db.query(`SELECT id, active FROM users WHERE id=$1 FOR ${write ? 'UPDATE' : 'SHARE'}`, [userId])).rows[0] ?? null
}
export async function findSupportReplay(db, userId, requestId) {
  return (await db.query(`SELECT ${fields}, request_hash FROM support_tickets WHERE user_id=$1 AND request_id=$2`, [userId, requestId])).rows[0] ?? null
}
export async function lockSupportSalonAccess(db, userId, salonId) {
  return (await db.query(`SELECT m.id FROM salon_memberships m JOIN salons s ON s.id=m.salon_id
    WHERE m.user_id=$1 AND m.salon_id=$2 AND m.active AND s.active FOR SHARE OF m,s`, [userId, salonId])).rows.length > 0
}
export async function supportQuotaAvailable(db, userId) {
  const row = (await db.query(`SELECT count(*) FILTER (WHERE created_at > clock_timestamp()-interval '1 hour')::int AS hourly,
    count(*)::int AS daily FROM support_tickets WHERE user_id=$1 AND created_at > clock_timestamp()-interval '24 hours'`, [userId])).rows[0]
  return row.hourly < 5 && row.daily < 20
}
export async function insertSupportTicket(db, userId, draft, hash) {
  return (await db.query(`INSERT INTO support_tickets(user_id,salon_id,request_id,request_hash,category,subject,description,language,context)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING ${fields}`,
    [userId,draft.salon_id,draft.request_id,hash,draft.category,draft.subject,draft.description,draft.language,JSON.stringify(draft.context)])).rows[0]
}
export async function listSupportTickets(db, userId, before, limit) {
  return (await db.query(`SELECT id, salon_id, category, subject, language, status, created_at, updated_at
    FROM support_tickets WHERE user_id=$1 AND ($2::bigint IS NULL OR id<$2)
    ORDER BY id DESC LIMIT $3`, [userId,before,limit])).rows
}
export async function findSupportTicket(db, userId, ticketId) {
  return (await db.query(`SELECT ${fields} FROM support_tickets WHERE user_id=$1 AND id=$2`, [userId,ticketId])).rows[0] ?? null
}
