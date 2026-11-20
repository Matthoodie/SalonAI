import {readHeldNotifications} from '../repositories/supportNotificationRepository.js'
import {replyNotificationPreview} from '../utils/supportNotification.js'
import {supportId} from '../utils/supportTicketValidation.js'

// Local administrator capability via DB credentials; not an HTTP/public API.
export async function previewSupportNotifications(dbPool, {database,before=null}) {
  if (typeof database !== 'string' || !/^[a-zA-Z0-9_-]{1,63}$/.test(database)) throw new Error('An explicit database name is required.')
  if (before !== null) before=supportId(before)
  const db=await dbPool.connect()
  try {
    await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const current=(await db.query('SELECT current_database() AS name')).rows[0].name
    if (current !== database) throw new Error('Database name mismatch. Nothing was changed.')
    const rows=await readHeldNotifications(db,before),events=rows.slice(0,20)
    const result={delivery_enabled:false,state:'held',events:events.map(row=>({
      id:String(row.id),ticket_id:String(row.ticket_id),message_id:String(row.message_id),
      language:row.language,created_at:row.created_at,
      preview:replyNotificationPreview(row.ticket_id,row.language),
    })),next_before:rows.length>20 ? String(events.at(-1).id) : null}
    await db.query('COMMIT')
    return result
  } catch(error) {
    try { await db.query('ROLLBACK') } catch { /* Keep original failure. */ }
    throw error
  } finally { db.release() }
}
