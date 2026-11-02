export async function findSetupOwner(db, { salonId, userId }) {
  // Recheck and lock authoritative context for the duration of this transaction.
  const result = await db.query(`
    SELECT s.id, s.name, s.timezone
    FROM salons s
    JOIN salon_memberships sm ON sm.salon_id = s.id
    JOIN users u ON u.id = sm.user_id
    WHERE s.id = $1 AND u.id = $2 AND s.active AND u.active
      AND sm.active AND sm.role = 'owner'
    FOR SHARE OF s, sm, u
  `, [salonId, userId])
  return result.rows[0] ?? null
}
export async function findSalonSetup(db, salonId) {
  const result = await db.query(`SELECT salon_id, business_type, location, team_mode,
    owner_provides_services, last_step, revision, updated_by_user_id, updated_at
    FROM salon_setup WHERE salon_id = $1`, [salonId])
  return result.rows[0] ?? null
}
export async function saveSalonSetup(db, { salonId, userId }, draft) {
  // Unique salon key serializes concurrent first saves. The conditional UPDATE
  // also prevents lost updates when a second tab submits an older revision.
  await db.query('INSERT INTO salon_setup (salon_id) VALUES ($1) ON CONFLICT (salon_id) DO NOTHING', [salonId])
  const result = await db.query(`UPDATE salon_setup SET business_type=$3, location=$4,
    team_mode=$5, owner_provides_services=$6, last_step=$7, revision=revision+1,
    updated_by_user_id=$2, updated_at=clock_timestamp()
    WHERE salon_id=$1 AND revision=$8
    RETURNING salon_id, business_type, location, team_mode, owner_provides_services,
      last_step, revision, updated_by_user_id, updated_at`,
  [salonId, userId, draft.business_type, draft.location, draft.team_mode,
    draft.owner_provides_services, draft.last_step, draft.expected_revision])
  return result.rows[0] ?? null
}
