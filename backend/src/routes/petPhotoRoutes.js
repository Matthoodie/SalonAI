import express from 'express'
import { petContext, petId } from '../utils/petValidation.js'
import { photoRevision, photoVersion, photoError, MAX_PET_PHOTO_BYTES } from '../utils/petPhoto.js'
import { createPetPhotoService } from '../services/petPhotoService.js'
export function createPetPhotoRouter({ service = createPetPhotoService() } = {}) {
  const router = express.Router(), uploads = new Map()
  const route = '/:clientId/pets/:petId/photo'
  router.use(route, (req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    try {
      req.photoContext = { ...petContext(req), clientId: petId(req.params.clientId), petId: petId(req.params.petId) }
      next()
    } catch (error) { next(error) }
  })
  router.get(route, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length !== 1) throw photoError('Pošaljite verziju fotografije.')
      const { pet, bytes } = await service.read(req.photoContext, photoVersion(req.query.version))
      res.set({ 'Content-Type': 'image/jpeg', 'Content-Disposition': 'inline; filename="pet.jpg"',
        'X-Pet-Id': String(pet.id), 'X-Client-Id': String(pet.client_id), 'X-Salon-Id': String(pet.salon_id), 'X-Pet-Photo-Version': String(pet.photo_version) })
      res.send(bytes)
    } catch (error) { next(error) }
  })
  router.put(route, (req, res, next) => {
    try {
      req.photoRevision = photoRevision(req.get('If-Match'))
      if (Object.keys(req.query).length || !req.is('application/octet-stream')) throw photoError('Pošaljite fotografiju kao datoteku.', 'PET_PHOTO_FORMAT', 415)
      const key = String(req.photoContext.salonId)
      if (uploads.has(key) || uploads.size >= 4) throw photoError('Prijenos fotografije je već u tijeku. Pričekajte.', 'PET_PHOTO_BUSY', 429)
      const token = Symbol()
      uploads.set(key, token)
      const release = () => { if (uploads.get(key) === token) uploads.delete(key) }
      let parsing = true, handling = false, closed = false
      // Keep the slot until decoding/transaction ends, even if the client disconnects.
      req.releasePhotoSlot = release
      res.once('close', () => { closed = true; if (!parsing && !handling) release() })
      req.beginPhotoHandling = () => { parsing = false; handling = true }
      req.endPhotoParsing = () => { parsing = false; if (closed) release() }
      next()
    } catch (error) { next(error) }
  }, express.raw({ type: 'application/octet-stream', limit: MAX_PET_PHOTO_BYTES, inflate: false }), async (req, res, next) => {
    req.beginPhotoHandling()
    try { res.json({ data: await service.upload(req.photoContext, req.body, req.photoRevision) }) }
    catch (error) { next(error) }
    finally { req.releasePhotoSlot() }
  })
  router.delete(route, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length) throw photoError('Neispravan zahtjev.')
      res.json({ data: await service.remove(req.photoContext, photoRevision(req.get('If-Match'))) })
    } catch (error) { next(error) }
  })
  router.use((error, req, res, next) => {
    req.endPhotoParsing?.(); req.releasePhotoSlot?.()
    if (res.headersSent) return next(error)
    // Do not log raw image bytes or database connection details.
    const known = error?.code?.startsWith('PET_') || error?.code === 'CLIENT_NOT_FOUND'
    const oversized = error?.type === 'entity.too.large'
    const encoding = error?.type === 'encoding.unsupported'
    res.status(oversized ? 413 : encoding ? 415 : known ? error.statusCode : 503).json({ error: {
      code: oversized ? 'PET_PHOTO_TOO_LARGE' : encoding ? 'PET_PHOTO_FORMAT' : known ? error.code : 'PET_PHOTO_UNAVAILABLE',
      message: oversized ? 'Fotografija smije imati najviše 8 MB.' : encoding ? 'Komprimirani prijenos nije podržan.' : known ? error.message : 'Fotografije trenutačno nisu dostupne. Osvježite popis i provjerite stanje prije ponovnog spremanja.',
    } })
  })
  return router
}
export default createPetPhotoRouter()
