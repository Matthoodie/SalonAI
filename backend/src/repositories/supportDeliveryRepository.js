import {randomUUID} from 'node:crypto'
import {safeDeliveryOutcome} from '../utils/supportDelivery.js'

// Caller owns a transaction. Lock author before event, matching support write order.
export async function lockDeliveryEvent(db, eventId, authorId) {
 const user=(await db.query('SELECT id,active,auth_provider,auth_subject FROM users WHERE id=$1 FOR SHARE',[authorId])).rows[0]
 if (!user) return null
 const row=(await db.query(`SELECT o.*,m.ticket_id,t.user_id FROM support_notification_outbox o
   JOIN support_ticket_messages m ON m.id=o.message_id JOIN support_tickets t ON t.id=m.ticket_id
   WHERE o.id=$1 AND t.user_id=$2 FOR UPDATE OF o`,[eventId,authorId])).rows[0]
 return row ? {...row,account_active:user.active,auth_provider:user.auth_provider,auth_subject:user.auth_subject} : null
}
export async function readDeliveryIdentity(db,eventId,authorId) {
 return (await db.query(`SELECT u.active,u.auth_provider,u.auth_subject FROM support_notification_outbox o
 JOIN support_ticket_messages m ON m.id=o.message_id JOIN support_tickets t ON t.id=m.ticket_id
 JOIN users u ON u.id=t.user_id WHERE o.id=$1 AND u.id=$2`,[eventId,authorId])).rows[0] ?? null
}
export async function prepareDelivery(db,row,{recipient,subject,text,activationAfter}) {
 const eligible=(await db.query('SELECT $1::timestamptz >= $2::timestamptz AS ok',[row.created_at,activationAfter])).rows[0].ok
 if (!eligible) return {state:'held',reason:'before_activation'}
 if (row.state !== 'held') return {state:row.state,reason:'already_prepared'}
 await db.query(`INSERT INTO support_notification_delivery(event_id,idempotency_key,recipient,subject,text_body,activation_after)
 VALUES($1,$2,$3,$4,$5,$6)`,[row.id,randomUUID(),recipient,subject,text,activationAfter])
 await db.query("UPDATE support_notification_outbox SET state='ready' WHERE id=$1",[row.id])
 return {state:'ready'}
}
export async function claimDelivery(db,row,recipient) {
 if (!['ready','sending'].includes(row.state)) return {state:row.state}
 const d=(await db.query(`SELECT *,clock_timestamp() AS db_now FROM support_notification_delivery WHERE event_id=$1 FOR UPDATE`,[row.id])).rows[0]
 if (!d) throw Error('Missing delivery snapshot.')
 const now=new Date(d.db_now).getTime()
 if (row.state==='sending') {
  if(new Date(d.lease_until).getTime()>now)return {state:'sending',reason:'busy'}
  await db.query("UPDATE support_notification_attempts SET outcome='lease_expired',finished_at=clock_timestamp() WHERE token=$1 AND outcome='started'",[d.lease_token])
  await db.query("UPDATE support_notification_delivery SET lease_token=NULL,lease_until=NULL,last_outcome='lease_expired' WHERE event_id=$1",[row.id])
  await db.query("UPDATE support_notification_outbox SET state='uncertain' WHERE id=$1",[row.id])
  return {state:'uncertain',reason:'lease_expired'}
 }
 if(d.recipient!==recipient) {
  await db.query("UPDATE support_notification_delivery SET last_outcome='contact_changed' WHERE event_id=$1",[row.id])
  await db.query("UPDATE support_notification_outbox SET state='suppressed' WHERE id=$1",[row.id])
  return {state:'suppressed',reason:'contact_changed'}
 }
 // Include two minutes of margin for the request; never extend first-attempt deadline.
 if(d.attempt_count>=3 || (d.retry_until && new Date(d.retry_until).getTime()<=now+120000)) {
  await db.query("UPDATE support_notification_delivery SET last_outcome='retry_exhausted' WHERE event_id=$1",[row.id])
  await db.query("UPDATE support_notification_outbox SET state='suppressed' WHERE id=$1",[row.id])
  return {state:'suppressed',reason:'retry_exhausted'}
 }
 if(d.next_attempt_at && new Date(d.next_attempt_at).getTime()>now)return {state:'ready',reason:'backoff'}
 const token=randomUUID(),number=d.attempt_count+1
 await db.query(`UPDATE support_notification_delivery SET attempt_count=$2,lease_token=$3,lease_until=clock_timestamp()+interval '2 minutes',
 first_attempt_at=COALESCE(first_attempt_at,statement_timestamp()),retry_until=COALESCE(retry_until,statement_timestamp()+interval '23 hours'),next_attempt_at=NULL WHERE event_id=$1`,[row.id,number,token])
 await db.query('INSERT INTO support_notification_attempts(token,event_id,attempt_number) VALUES($1,$2,$3)',[token,row.id,number])
 await db.query("UPDATE support_notification_outbox SET state='sending' WHERE id=$1",[row.id])
 return {state:'sending',token,payload:{to:d.recipient,subject:d.subject,text:d.text_body,idempotencyKey:'support-reply/'+d.idempotency_key}}
}
export async function finishDelivery(db,eventId,token,result) {
 // Lock event before delivery, consistent with claim. No user/network access here.
 const row=(await db.query('SELECT state FROM support_notification_outbox WHERE id=$1 FOR UPDATE',[eventId])).rows[0]
 if(!row)return {state:'missing'}
 const d=(await db.query('SELECT * FROM support_notification_delivery WHERE event_id=$1 FOR UPDATE',[eventId])).rows[0]
 if(row.state!=='sending'||d?.lease_token!==token)return {state:row.state,reason:'stale_attempt'}
 const safe=safeDeliveryOutcome(result)
 const state=safe.outcome==='accepted'?'accepted':safe.outcome==='rejected'?'rejected':
   safe.outcome==='rate_limited' && d.attempt_count<3?'ready':
   ['blocked','disabled','rate_limited'].includes(safe.outcome)?'suppressed':'uncertain'
 await db.query(`UPDATE support_notification_attempts SET outcome=$2,provider_id=$3,finished_at=clock_timestamp() WHERE token=$1`,[token,safe.outcome,safe.providerId])
 await db.query(`UPDATE support_notification_delivery SET lease_token=NULL,lease_until=NULL,last_outcome=$2,provider_id=$3,
 next_attempt_at=CASE WHEN $4='ready' THEN clock_timestamp()+interval '5 minutes' ELSE NULL END,
 accepted_at=CASE WHEN $4='accepted' THEN clock_timestamp() ELSE NULL END WHERE event_id=$1`,[eventId,safe.outcome,safe.providerId,state])
 await db.query('UPDATE support_notification_outbox SET state=$2 WHERE id=$1',[eventId,state])
 return {state,...(safe.providerId?{providerId:safe.providerId}:{})}
}
