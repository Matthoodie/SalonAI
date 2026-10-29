export const MAX_IMPORT_ITEMS = 100
const MAX_INTEGER = 2147483647
const rowKeys = new Set(['row_id', 'name', 'category', 'price_eur', 'default_duration_minutes', 'allow_duplicate'])
export function importError(message, code = 'SERVICE_IMPORT_INVALID', statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode })
}
export function assertImportBody(body, confirm = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw importError('Podaci uvoza nisu ispravni.')
  const keys = confirm ? ['currency', 'items', 'request_id'] : ['currency', 'items']
  if (Object.keys(body).some(key => !keys.includes(key))) throw importError('Zahtjev sadrži nedopuštena polja.')
  if (body.currency !== 'EUR') throw importError('Potvrdite cijene u eurima. Automatska konverzija valuta nije podržana.')
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_IMPORT_ITEMS) {
    throw importError('U jednom uvozu odaberite od 1 do 100 usluga.')
  }
  if (confirm && (typeof body.request_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id))) {
    throw importError('Nedostaje valjana oznaka zahtjeva za spremanje.')
  }
  const seen = new Set()
  for (const item of body.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        Object.keys(item).some(key => !rowKeys.has(key))) throw importError('Redak uvoza sadrži nedopuštena polja.')
    if (typeof item.row_id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.row_id) || seen.has(item.row_id)) {
      throw importError('Svaki redak mora imati jedinstvenu oznaku.')
    }
    seen.add(item.row_id)
    if (item.allow_duplicate !== undefined && typeof item.allow_duplicate !== 'boolean') {
      throw importError('Potvrda mogućeg duplikata mora biti logička vrijednost.')
    }
  }
}
function cleanText(value, limit, fallback = '') {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null
  const text = value.normalize('NFC').trim().replace(/\s+/gu, ' ')
  if (!text) return fallback
  return Array.from(text).length <= limit ? text : null
}
export function normalizedServiceName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('hr-HR') : ''
}
export function priceToCents(value) {
  // Decimal strings only: no float multiplication, currency guessing or thousands separators.
  if (typeof value !== 'string' || value.length > 32) return null
  const match = /^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_INTEGER ? cents : null
}
export function normalizeImportItems(items) {
  return items.map(item => {
    const name = cleanText(item.name, 150)
    const category = cleanText(item.category, 100, 'Ostalo')
    const price = priceToCents(item.price_eur)
    const rawDuration = item.default_duration_minutes
    const duration = (typeof rawDuration === 'number' || typeof rawDuration === 'string') &&
      /^[1-9]\d*$/.test(String(rawDuration).trim()) ? Number(rawDuration) : null
    const issues = []
    if (!name) issues.push({ field: 'name', code: 'INVALID_NAME', message: 'Unesite naziv usluge do 150 znakova.' })
    if (!category) issues.push({ field: 'category', code: 'INVALID_CATEGORY', message: 'Kategorija smije imati najviše 100 znakova.' })
    if (price === null) issues.push({ field: 'price_eur', code: 'INVALID_PRICE', message: 'Unesite jednu cijenu u eurima, s najviše dvije decimale.' })
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > MAX_INTEGER) {
      issues.push({ field: 'default_duration_minutes', code: 'INVALID_DURATION', message: 'Unesite trajanje u cijelim minutama, najmanje 1.' })
    }
    return {
      row_id: item.row_id, name, category, price_cents: price,
      default_duration_minutes: duration,
      allow_duplicate: item.allow_duplicate === true,
      issues,
    }
  })
}
export function reviewImportRows(rows, catalog) {
  return rows.map(row => {
    const key = normalizedServiceName(row.name)
    const matches = key ? catalog.filter(service => normalizedServiceName(service.name) === key) : []
    const peers = key ? rows.filter(other => other.row_id !== row.row_id && normalizedServiceName(other.name) === key) : []
    const duplicates = matches.slice(0, 20).map(service => ({
      service_id: service.id, name: service.name, category: service.category,
      active: service.active,
      kind: normalizedServiceName(service.category) === normalizedServiceName(row.category) ? 'same_name_category' : 'same_name',
    }))
    const needsConfirmation = matches.length > 0 || peers.length > 0
    const issues = [...row.issues]
    if (needsConfirmation && !row.allow_duplicate) issues.push({
      field: 'name', code: 'POSSIBLE_DUPLICATE',
      message: 'Pronađena je usluga istog naziva. Preskočite redak, promijenite naziv ili izričito potvrdite dodavanje.',
    })
    return { ...row, duplicates, duplicate_count: matches.length, duplicate_row_ids: peers.map(peer => peer.row_id),
      issues, ready: issues.length === 0 }
  })
}
export function canonicalImport(rows) {
  return rows.map(row => ({
    row_id: row.row_id, name: row.name, category: row.category,
    price_cents: row.price_cents, default_duration_minutes: row.default_duration_minutes,
    allow_duplicate: row.allow_duplicate,
  }))
}
