import { createHash } from 'node:crypto'
import { findServicesBySalonId, insertService } from '../repositories/serviceRepository.js'
import { findImportReceipt, insertImportReceipt } from '../repositories/serviceImportRepository.js'
import { withServiceCatalogTransaction } from './serviceCatalogTransaction.js'
import { assertImportBody, normalizeImportItems, reviewImportRows, canonicalImport, importError } from '../utils/serviceImportValidation.js'

function prepared(body, confirm) {
  assertImportBody(body, confirm)
  return normalizeImportItems(body.items)
}
export async function previewServiceImport({ salonId, body }) {
  const rows = prepared(body, false)
  const catalog = await findServicesBySalonId(salonId)
  const reviewed = reviewImportRows(rows, catalog)
  return { currency: 'EUR', rows: reviewed, ready_count: reviewed.filter(row => row.ready).length,
    needs_review_count: reviewed.filter(row => !row.ready).length }
}
export async function confirmServiceImport({ salonId, userId, body }) {
  const rows = prepared(body, true)
  if (rows.some(row => row.issues.length)) throw importError('Dopunite neispravne odabrane retke prije spremanja.')
  const requestId = body.request_id.toLowerCase()
  const hash = createHash('sha256').update(JSON.stringify({ currency: 'EUR', items: canonicalImport(rows) })).digest('hex')
  return withServiceCatalogTransaction(salonId, async db => {
    const receipt = await findImportReceipt(db, salonId, requestId)
    if (receipt) {
      if (receipt.request_hash !== hash || String(receipt.requested_by_user_id) !== String(userId)) {
        throw importError('Oznaka uvoza već je upotrijebljena za drugi zahtjev.', 'SERVICE_IMPORT_KEY_REUSED', 409)
      }
      return { ...receipt.response, replayed: true }
    }
    const catalog = await findServicesBySalonId(salonId, db)
    const reviewed = reviewImportRows(rows, catalog)
    if (reviewed.some(row => !row.ready)) {
      throw importError('Pronađene su moguće duple usluge. Ponovno pregledajte nacrt i potvrdite ili uklonite podudaranja.',
        'SERVICE_IMPORT_REVIEW_REQUIRED', 409)
    }
    const services = [], rowServiceIds = []
    for (const row of rows) {
      const service = await insertService({
        salonId, name: row.name, category: row.category, priceCents: row.price_cents,
        defaultDurationMinutes: row.default_duration_minutes,
      }, db)
      services.push(service)
      rowServiceIds.push({ row_id: row.row_id, service_id: service.id })
    }
    // Persist the original response, not live services: edits after import must not
    // change the outcome of a retry whose first HTTP response was lost.
    const response = JSON.parse(JSON.stringify({
      request_id: requestId, currency: 'EUR', created_count: services.length,
      services, row_service_ids: rowServiceIds,
    }))
    await insertImportReceipt(db, { salonId, userId, requestId, hash, response })
    return { ...response, replayed: false }
  })
}
