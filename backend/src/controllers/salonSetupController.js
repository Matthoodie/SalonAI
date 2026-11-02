import { getSalonSetup, updateSalonSetup } from '../services/salonSetupService.js'
import { assertSalonSetupContext } from '../utils/salonSetupValidation.js'
export async function getSalonSetupController(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try { res.json({ data: await getSalonSetup(assertSalonSetupContext(req)) }) }
  catch (error) { next(error) }
}
export async function updateSalonSetupController(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try { res.json({ data: await updateSalonSetup({ ...assertSalonSetupContext(req), body: req.body }) }) }
  catch (error) { next(error) }
}
