import pool from '../database/pool.js'
import { withAppointmentTransaction } from './appointmentTransaction.js'
import { findAppointmentById } from '../repositories/appointmentRepository.js'
import { findEmployeeForUpdate } from '../repositories/employeeRepository.js'
import { lockPetBusiness, lockPetClient } from '../repositories/petRepository.js'
import { recipientError, recipientId, parseRecipient, parseRecipientChange, validateRecipientBusiness } from '../utils/appointmentRecipient.js'

// Run inside the booking transaction; locks serialize pet/client archival with selection.
export async function prepareRecipient(db, salonId, clientId, input) {
  const selection = parseRecipient(input, { allowLegacy: true })
  const empty = { ...selection, pet_name: null, pet_species: null, pet_breed: null }
  const setup = await lockPetBusiness(db, salonId)
  if (selection.recipient_type === null) {
    if (setup?.business_type === 'grooming') throw recipientError('APPOINTMENT_PET_REQUIRED','Odaberite ljubimca za grooming termin.')
    return empty
  }
  validateRecipientBusiness(selection.recipient_type, setup?.business_type)
  const client = await lockPetClient(db, salonId, clientId)
  if (!client) throw recipientError('CLIENT_NOT_FOUND','Vlasnik nije pronađen u ovom salonu.',404)
  if (!client.active) throw recipientError('CLIENT_INACTIVE','Najprije aktivirajte vlasnika.',409)
  if (selection.recipient_type === 'person') return empty
  const pet = (await db.query(`SELECT id,name,species,breed,active FROM client_pets
    WHERE salon_id=$1 AND client_id=$2 AND id=$3 FOR SHARE`, [salonId,clientId,selection.pet_id])).rows[0]
  if (!pet) throw recipientError('PET_NOT_FOUND','Ljubimac ne pripada odabranom vlasniku u ovom salonu.',404)
  if (!pet.active) throw recipientError('PET_INACTIVE','Arhivirani ljubimac nije dostupan za novi termin.',409)
  return { ...selection, pet_name: pet.name, pet_species: pet.species, pet_breed: pet.breed }
}

async function lockedAppointment(db, salonId, appointmentId, employeeScope) {
  const original = await findAppointmentById(appointmentId,salonId,employeeScope,db)
  if (!original) throw recipientError('APPOINTMENT_NOT_FOUND','Termin nije pronađen.',404)
  // Same lock order as reschedule / service composition writes.
  await findEmployeeForUpdate(db,{employeeId:original.employee_id,salonId})
  const row = (await db.query(`SELECT * FROM appointments WHERE id=$1 AND salon_id=$2
    AND ($3::bigint IS NULL OR employee_id=$3) FOR UPDATE`,[appointmentId,salonId,employeeScope])).rows[0]
  if (!row) throw recipientError('APPOINTMENT_NOT_FOUND','Termin nije pronađen.',404)
  if (!['pending','confirmed'].includes(row.status)) throw recipientError('APPOINTMENT_CLIENT_CHANGE_NOT_ALLOWED','Vlasnik i ljubimac mogu se mijenjati samo na aktivnom terminu.',409)
  return row
}

export async function changeAppointmentRecipient({salonId,appointmentId,employeeScope=null,body}) {
  salonId=recipientId(salonId); appointmentId=recipientId(appointmentId)
  if (employeeScope !== null) employeeScope=recipientId(employeeScope)
  const input=parseRecipientChange(body)
  return withAppointmentTransaction(async db => {
    const row=await lockedAppointment(db,salonId,appointmentId,employeeScope)
    if (row.recipient_revision!==input.expected_recipient_revision) throw recipientError('APPOINTMENT_RECIPIENT_CONFLICT','Vlasnik ili ljubimac već su promijenjeni. Osvježite termin.',409)
    // An unchanged recipient retains the historical snapshot, even after archival.
    if (String(row.client_id)===String(input.client_id) && row.recipient_type===input.recipient_type && String(row.pet_id)===String(input.pet_id)) {
      return findAppointmentById(appointmentId,salonId,employeeScope,db)
    }
    const recipient=await prepareRecipient(db,salonId,input.client_id,input)
    await db.query(`UPDATE appointments SET client_id=$3,recipient_type=$4,pet_id=$5,
      pet_name=$6,pet_species=$7,pet_breed=$8,recipient_revision=recipient_revision+1,updated_at=clock_timestamp()
      WHERE id=$1 AND salon_id=$2`,[appointmentId,salonId,input.client_id,recipient.recipient_type,
      recipient.pet_id,recipient.pet_name,recipient.pet_species,recipient.pet_breed])
    return findAppointmentById(appointmentId,salonId,employeeScope,db)
  })
}

// Compatibility endpoint cannot clear or silently transfer a linked pet.
export async function changeLegacyAppointmentClient(appointmentId,salonId,clientId,employeeScope=null) {
  return withAppointmentTransaction(async db => {
    const row=await lockedAppointment(db,salonId,appointmentId,employeeScope)
    if (row.pet_id!==null) throw recipientError('APPOINTMENT_RECIPIENT_UPDATE_REQUIRED','Za ovaj termin vlasnika i ljubimca izmijenite zajedno.',409)
    const client=await lockPetClient(db,salonId,clientId)
    if (!client) throw recipientError('CLIENT_NOT_FOUND','Klijent nije pronađen.',404)
    if (!client.active) throw recipientError('CLIENT_INACTIVE','Klijent nije aktivan.',400)
    if (String(row.client_id)!==String(clientId)) {
      if (row.recipient_revision>=2147483647) throw recipientError('INVALID_RECIPIENT_REVISION','Verzija termina nije podržana.',409)
      await db.query(`UPDATE appointments SET client_id=$3,recipient_revision=recipient_revision+1,
        updated_at=clock_timestamp() WHERE id=$1 AND salon_id=$2`,[appointmentId,salonId,clientId])
    }
    return {data:await findAppointmentById(appointmentId,salonId,employeeScope,db)}
  })
}

export async function getBookingPetOptions({salonId,clientId,afterId=0,appointmentId=null,employeeScope=null}) {
  salonId=recipientId(salonId);clientId=recipientId(clientId)
  if (afterId!==0) afterId=recipientId(afterId)
  if (appointmentId!==null) {
    appointmentId=recipientId(appointmentId)
    if (!await findAppointmentById(appointmentId,salonId,employeeScope)) throw recipientError('APPOINTMENT_NOT_FOUND','Termin nije pronađen.',404)
  }
  const setup=(await pool.query('SELECT business_type FROM salon_setup WHERE salon_id=$1',[salonId])).rows[0]
  validateRecipientBusiness('pet',setup?.business_type)
  const client=(await pool.query('SELECT id,active FROM clients WHERE salon_id=$1 AND id=$2',[salonId,clientId])).rows[0]
  if (!client) throw recipientError('CLIENT_NOT_FOUND','Klijent nije pronađen.',404)
  if (!client.active) throw recipientError('CLIENT_INACTIVE','Klijent nije aktivan.',409)
  // Booking-only projection: no notes, owner contacts, or profile mutation permissions.
  const rows=(await pool.query(`SELECT id,salon_id,client_id,name,species,breed FROM client_pets
    WHERE salon_id=$1 AND client_id=$2 AND active AND id>$3 ORDER BY id LIMIT 51`,[salonId,clientId,afterId])).rows
  return {salon_id:salonId,client_id:clientId,business_type:setup.business_type,
    pets:rows.slice(0,50),next_cursor:rows.length>50?String(rows[49].id):null}
}
