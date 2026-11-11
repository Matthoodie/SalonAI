const columns = 'id,salon_id,client_id,name,species,breed,notes,active,revision,created_at,updated_at,photo_version,(photo_data IS NOT NULL) AS has_photo'
export async function lockPetAccess(db, { salonId, userId }) {
  const result = await db.query(`SELECT s.id FROM salons s
    JOIN salon_memberships m ON m.salon_id=s.id JOIN users u ON u.id=m.user_id
    WHERE s.id=$1 AND u.id=$2 AND s.active AND u.active AND m.active AND m.role IN ('owner','admin')
    FOR SHARE OF s,m,u`, [salonId,userId])
  return result.rows[0] ?? null
}
export async function lockPetBusiness(db, salonId) {
  return (await db.query('SELECT business_type FROM salon_setup WHERE salon_id=$1 FOR SHARE',[salonId])).rows[0] ?? null
}
export async function lockPetClient(db, salonId, clientId) {
  return (await db.query('SELECT id,active FROM clients WHERE salon_id=$1 AND id=$2 FOR SHARE',[salonId,clientId])).rows[0] ?? null
}
export async function listPets(db, salonId, clientId) {
  return (await db.query(`SELECT ${columns} FROM client_pets WHERE salon_id=$1 AND client_id=$2 ORDER BY active DESC,name,id`,[salonId,clientId])).rows
}
export async function insertPet(db, salonId, clientId, input) {
  return (await db.query(`INSERT INTO client_pets(salon_id,client_id,name,species,breed,notes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${columns}`,
  [salonId,clientId,input.name,input.species,input.breed,input.notes])).rows[0]
}
export async function lockPet(db, salonId, clientId, id) {
  return (await db.query(`SELECT ${columns} FROM client_pets WHERE salon_id=$1 AND client_id=$2 AND id=$3 FOR UPDATE`,[salonId,clientId,id])).rows[0] ?? null
}
export async function savePet(db, salonId, clientId, id, input, statusOnly) {
  const values = statusOnly ? [input.active] : [input.name,input.species,input.breed,input.notes]
  const set = statusOnly ? 'active=$4' : 'name=$4,species=$5,breed=$6,notes=$7'
  return (await db.query(`UPDATE client_pets SET ${set},revision=revision+1,updated_at=clock_timestamp()
    WHERE salon_id=$1 AND client_id=$2 AND id=$3 RETURNING ${columns}`,[salonId,clientId,id,...values])).rows[0]
}
