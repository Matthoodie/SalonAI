import { withPetClient } from './petService.js'
import { lockPet } from '../repositories/petRepository.js'
import { petId, petError } from '../utils/petValidation.js'
import { photoError, MAX_SAVED_PHOTO_BYTES } from '../utils/petPhoto.js'
import { processPetPhoto } from './petPhotoImageService.js'

async function withPhoto(context, run) {
  const petIdValue = petId(context.petId)
  return withPetClient(context, async (db, ids, client) => {
    const pet = await lockPet(db, ids.salonId, ids.clientId, petIdValue)
    if (!pet) throw petError('Ljubimac nije pronađen za ovog vlasnika.', 'PET_NOT_FOUND', 404)
    return run(db, ids, client, pet)
  })
}
function checkWrite(pet, client, expectedRevision, uploading) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1 || expectedRevision >= 2147483647) throw photoError('Neispravna verzija profila.')
  if (pet.revision !== expectedRevision) throw petError('Profil je promijenjen. Osvježite popis prije ponovnog spremanja.', 'PET_VERSION_CONFLICT', 409)
  if (pet.photo_version >= 2147483647) throw photoError('Fotografiju više nije moguće mijenjati.', 'PET_PHOTO_VERSION_LIMIT', 409)
  if (uploading && !client.active) throw petError('Najprije aktivirajte vlasnika.', 'PET_CLIENT_ARCHIVED', 409)
  if (uploading && !pet.active) throw photoError('Najprije ponovno aktivirajte ljubimca.', 'PET_PHOTO_ARCHIVED', 409)
}
export function createPetPhotoService({ processImage = processPetPhoto } = {}) {
  return {
    async read(context, version) {
      return withPhoto(context, async (db, ids, client, pet) => {
        if (!pet.has_photo) throw photoError('Fotografija nije pronađena.', 'PET_PHOTO_NOT_FOUND', 404)
        if (pet.photo_version !== version) throw photoError('Fotografija je promijenjena. Osvježite popis.', 'PET_PHOTO_CHANGED', 409)
        const row = (await db.query('SELECT photo_data FROM client_pets WHERE id=$1 AND client_id=$2 AND salon_id=$3', [pet.id, ids.clientId, ids.salonId])).rows[0]
        return { pet, bytes: row.photo_data }
      })
    },
    async upload(context, bytes, expectedRevision) {
      // Check authoritative access before decoding; repeat under lock before writing.
      await withPhoto(context, (db, ids, client, pet) => checkWrite(pet, client, expectedRevision, true))
      const image = await processImage(bytes)
      if (!Buffer.isBuffer(image.bytes) || image.bytes.length < 4 || image.bytes.length > MAX_SAVED_PHOTO_BYTES ||
          !image.bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) ||
          ![image.width, image.height].every(n => Number.isInteger(n) && n > 0 && n <= 768)) throw photoError('Obrada fotografije nije uspjela.')
      return withPhoto(context, async (db, ids, client, pet) => {
        checkWrite(pet, client, expectedRevision, true)
        await db.query(`UPDATE client_pets SET photo_data=$4,photo_width=$5,photo_height=$6,
          photo_version=photo_version+1,revision=revision+1,updated_at=clock_timestamp()
          WHERE id=$1 AND client_id=$2 AND salon_id=$3`, [pet.id, ids.clientId, ids.salonId, image.bytes, image.width, image.height])
        return lockPet(db, ids.salonId, ids.clientId, pet.id)
      })
    },
    async remove(context, expectedRevision) {
      return withPhoto(context, async (db, ids, client, pet) => {
        checkWrite(pet, client, expectedRevision, false)
        if (!pet.has_photo) return pet
        await db.query(`UPDATE client_pets SET photo_data=NULL,photo_width=NULL,photo_height=NULL,
          photo_version=photo_version+1,revision=revision+1,updated_at=clock_timestamp()
          WHERE id=$1 AND client_id=$2 AND salon_id=$3`, [pet.id, ids.clientId, ids.salonId])
        return lockPet(db, ids.salonId, ids.clientId, pet.id)
      })
    },
  }
}
