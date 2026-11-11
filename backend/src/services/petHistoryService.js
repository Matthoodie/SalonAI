import { withPetClient } from './petService.js'
import { petId, petError } from '../utils/petValidation.js'
import { historyCursor, nextHistoryCursor, PET_HISTORY_PAGE_SIZE } from '../utils/petHistory.js'
import { findPetHistory } from '../repositories/petHistoryRepository.js'
export async function getPetHistory(context, query = {}) {
  const ids = { salonId: petId(context.salonId), clientId: petId(context.clientId), petId: petId(context.petId) }
  const cursor = historyCursor(query, ids)
  return withPetClient(context, async db => {
    const pet = (await db.query('SELECT id FROM client_pets WHERE salon_id=$1 AND client_id=$2 AND id=$3 FOR SHARE',
      [ids.salonId, ids.clientId, ids.petId])).rows[0]
    if (!pet) throw petError('Ljubimac nije pronađen za ovog vlasnika.', 'PET_NOT_FOUND', 404)
    const salon = (await db.query('SELECT timezone FROM salons WHERE id=$1', [ids.salonId])).rows[0]
    const rows = await findPetHistory(db, ids, cursor)
    const page = rows.slice(0, PET_HISTORY_PAGE_SIZE)
    return { salon_id: ids.salonId, client_id: ids.clientId, pet_id: ids.petId, timezone: salon.timezone,
      appointments: page.map(({ cursor_start, ...row }) => row),
      next_cursor: rows.length > PET_HISTORY_PAGE_SIZE ? nextHistoryCursor(page.at(-1), ids) : null }
  })
}
