import pool from '../database/pool.js'
import {petError,petId,validatePet,validatePetActive} from '../utils/petValidation.js'
import {lockPetAccess,lockPetBusiness,lockPetClient,listPets,insertPet,lockPet,savePet} from '../repositories/petRepository.js'

export async function withPetClient(context, run) {
  const salonId=petId(context.salonId), userId=petId(context.userId), clientId=petId(context.clientId)
  const db=await pool.connect()
  try {
    await db.query('BEGIN')
    if (!await lockPetAccess(db,{salonId,userId})) throw petError('Nemate pristup profilima ljubimaca.','PET_FORBIDDEN',403)
    const setup=await lockPetBusiness(db,salonId)
    if (!['grooming','mixed'].includes(setup?.business_type)) throw petError('Profili ljubimaca dostupni su grooming i mješovitim salonima.','PET_BUSINESS_DISABLED',403)
    const client=await lockPetClient(db,salonId,clientId)
    if (!client) throw petError('Klijent nije pronađen u odabranom salonu.','CLIENT_NOT_FOUND',404)
    const result=await run(db,{salonId,clientId},client)
    await db.query('COMMIT')
    return result
  } catch (error) {
    try { await db.query('ROLLBACK') } catch { /* Preserve original error. */ }
    throw error
  } finally { db.release() }
}
function requireActiveClient(client) {
  if (!client.active) throw petError('Najprije ponovno aktivirajte vlasnika ljubimca.','PET_CLIENT_ARCHIVED',409)
}
export async function getClientPets(context) {
  return withPetClient(context,(db,ids)=>listPets(db,ids.salonId,ids.clientId))
}
export async function createClientPet({body,...context}) {
  const input=validatePet(body)
  return withPetClient(context,(db,ids,client)=>{
    requireActiveClient(client)
    return insertPet(db,ids.salonId,ids.clientId,input)
  })
}
async function update(context,input,statusOnly) {
  const id=petId(context.petId)
  return withPetClient(context,async(db,ids,client)=>{
    const pet=await lockPet(db,ids.salonId,ids.clientId,id)
    if (!pet) throw petError('Ljubimac nije pronađen za ovog klijenta.','PET_NOT_FOUND',404)
    if (pet.revision!==input.expected_revision) throw petError('Profil je promijenjen. Ponovno ga učitajte prije spremanja.','PET_VERSION_CONFLICT',409)
    // Archiving remains possible for an archived owner; other writes require an active owner.
    if (!statusOnly || input.active) requireActiveClient(client)
    if (statusOnly && pet.active===input.active) return pet
    return savePet(db,ids.salonId,ids.clientId,id,input,statusOnly)
  })
}
export async function updateClientPet({body,...context}) { return update(context,validatePet(body,true),false) }
export async function setClientPetActive({body,...context}) { return update(context,validatePetActive(body),true) }
