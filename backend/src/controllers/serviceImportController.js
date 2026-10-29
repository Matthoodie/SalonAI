import { previewServiceImport, confirmServiceImport } from '../services/serviceImportService.js'
import { importError } from '../utils/serviceImportValidation.js'

function context(req) {
  const salonId = Number(req.currentSalon?.id)
  const userId = Number(req.currentUser?.id)
  const member = req.currentMembership
  if (!Number.isSafeInteger(salonId) || salonId < 1 ||
      !Number.isSafeInteger(userId) || userId < 1 || req.currentUser?.active !== true ||
      req.currentSalon?.active === false || member?.active !== true ||
      !['owner', 'admin'].includes(member.role) ||
      String(member.salonId) !== String(salonId) || String(member.userId) !== String(userId)) {
    throw importError('Nemate dopuštenje za uvoz u odabrani salon.', 'SERVICE_IMPORT_FORBIDDEN', 403)
  }
  return { salonId, userId }
}
export async function previewServiceImportController(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try { res.status(200).json({ data: await previewServiceImport({ ...context(req), body: req.body }) }) }
  catch (error) { next(error) }
}
export async function confirmServiceImportController(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try {
    const result = await confirmServiceImport({ ...context(req), body: req.body })
    res.status(result.replayed ? 200 : 201).json({ data: result })
  } catch (error) { next(error) }
}
