export async function databaseIdentity(db){return (await db.query('SELECT current_database() AS name, current_user AS role')).rows[0]}
export async function findSupportIdentity(db,subject,write=false){
 const result=await db.query(`SELECT id,active,auth_provider,auth_subject FROM users WHERE auth_provider='clerk' AND auth_subject=$1 FOR ${write?'UPDATE':'SHARE'}`,[subject])
 return result.rows.length===1?result.rows[0]:null
}
export async function lockSupportIdentityById(db,userId){
 return (await db.query('SELECT id,active,auth_provider,auth_subject FROM users WHERE id=$1 FOR SHARE',[userId])).rows[0]??null
}
export async function readSupportGrant(db,userId,write=false){
 return (await db.query(`SELECT user_id,auth_subject,enabled,revision FROM platform_support_access WHERE user_id=$1 FOR ${write?'UPDATE':'SHARE'}`,[userId])).rows[0]??null
}
export async function writeSupportGrant(db,userId,subject,enabled,revision){
 return (await db.query(`INSERT INTO platform_support_access(user_id,auth_subject,enabled,revision) VALUES ($1,$2,$3,$4)
 ON CONFLICT(user_id) DO UPDATE SET auth_subject=EXCLUDED.auth_subject,enabled=EXCLUDED.enabled,revision=EXCLUDED.revision,updated_at=clock_timestamp()
 RETURNING user_id,auth_subject,enabled,revision`,[userId,subject,enabled,revision])).rows[0]
}
export async function appendSupportAccessAudit(db,userId,change,previousEnabled,revision){
 // Database role comes from PostgreSQL, never from a user-supplied actor field.
 await db.query(`INSERT INTO platform_support_access_audit(target_user_id,target_user_id_snapshot,action,previous_enabled,enabled,revision,reason)
 VALUES ($1,$1,$2,$3,$4,$5,$6)`,[userId,change.action,previousEnabled,change.action==='grant',revision,change.reason])
}
