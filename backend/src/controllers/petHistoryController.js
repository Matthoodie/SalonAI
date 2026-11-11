import { petContext, petId } from '../utils/petValidation.js'
import { getPetHistory } from '../services/petHistoryService.js'
export async function getHistory(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try {
    const context = { ...petContext(req), clientId: petId(req.params.clientId), petId: petId(req.params.petId) }
    res.json({ data: await getPetHistory(context, req.query) })
  } catch (error) { next(error) }
}
