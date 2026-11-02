export async function lockCreationUser(db, userId, exclusive = false) {
  const result = await db.query(`SELECT id, auth_provider, auth_subject, active FROM users
    WHERE id=$1 FOR ${exclusive ? 'UPDATE' : 'SHARE'}`, [userId])
  return result.rows[0] ?? null
}
export async function findCreationReceipt(db, userId) {
  return (await db.query('SELECT request_id, request_hash, salon_id, response FROM salon_creation_receipts WHERE user_id=$1', [userId])).rows[0] ?? null
}
export async function hasAnyMembership(db, userId) {
  return (await db.query('SELECT EXISTS(SELECT 1 FROM salon_memberships WHERE user_id=$1) AS present', [userId])).rows[0].present
}
export async function findReplayAccess(db, userId, salonId) {
  return (await db.query(`SELECT sm.id FROM salon_memberships sm JOIN salons s ON s.id=sm.salon_id
    WHERE sm.user_id=$1 AND s.id=$2 AND sm.active AND s.active AND sm.role='owner'
    FOR SHARE OF sm, s`, [userId, salonId])).rows[0] ?? null
}
export async function supportsTimezone(db, timezone) {
  return (await db.query('SELECT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=$1) AS present', [timezone])).rows[0].present
}
export async function insertCreatedSalon(db, userId, draft, requestHash) {
  const salon = (await db.query('INSERT INTO salons(name,timezone) VALUES ($1,$2) RETURNING id', [draft.name, draft.timezone])).rows[0]
  const membership = (await db.query("INSERT INTO salon_memberships(user_id,salon_id,role) VALUES ($1,$2,'owner') RETURNING id", [userId, salon.id])).rows[0]
  await db.query(`INSERT INTO salon_setup(salon_id,business_type,location,last_step,revision,updated_by_user_id)
    VALUES ($1,$2,$3,'team',1,$4)`, [salon.id, draft.business_type, draft.location, userId])
  await db.query('INSERT INTO salon_onboarding(salon_id,created_by_user_id) VALUES ($1,$2)', [salon.id, userId])
  // This immutable receipt is a creation result, not current salon/setup state.
  const response = { salon_id: salon.id, membership_id: membership.id }
  await db.query(`INSERT INTO salon_creation_receipts(user_id,request_id,request_hash,salon_id,response)
    VALUES ($1,$2,$3,$4,$5::jsonb)`, [userId, draft.request_id, requestHash, salon.id, JSON.stringify(response)])
  return response
}
export async function findOnboardingStatus(db, userId, salonId) {
  const access = (await db.query(`SELECT sm.salon_id FROM salon_memberships sm
    JOIN salons s ON s.id=sm.salon_id JOIN users u ON u.id=sm.user_id
    WHERE sm.salon_id=$1 AND sm.user_id=$2 AND sm.active AND s.active AND u.active
    FOR SHARE OF sm,s,u`, [salonId, userId])).rows[0]
  if (!access) return null
  const record = (await db.query('SELECT status FROM salon_onboarding WHERE salon_id=$1', [salonId])).rows[0]
  const status = record?.status ?? 'not_required'
  return { salon_id: access.salon_id, status, requires_setup: status === 'in_progress' }
}
