import { createHash } from 'node:crypto'

export const SUPPORT_CATEGORIES = Object.freeze(['help', 'bug', 'idea'])
export const SUPPORT_PAGES = Object.freeze([
  'welcome', 'onboarding', 'dashboard', 'clients', 'services', 'employees',
  'appointments', 'calendar', 'settings', 'time_off_requests',
  'blocked_time_requests', 'other',
])
export const SUPPORT_LIMITS = Object.freeze({subjectMin: 5, subjectMax: 160, descriptionMin: 20, descriptionMax: 5000, pageSize: 20})

function invalid(field) {
  const error = new Error('Invalid support request.')
  error.code = 'SUPPORT_VALIDATION_ERROR'
  error.statusCode = 400
  error.field = field
  return error
}
function object(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid(field)
  if (Object.keys(value).some(key => !allowed.includes(key))) throw invalid(field)
}
function text(value, min, max, field, multiline = false) {
  if (typeof value !== 'string' || value.length > max * 2 + 100) throw invalid(field)
  const result = value.replace(/\r\n/g, '\n').trim()
  if (Array.from(result).length < min || Array.from(result).length > max ||
      /[\u0000-\u0008\u000B-\u001F\u007F]/.test(result) ||
      (!multiline && /[\n\t]/.test(result)) ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(result)) throw invalid(field)
  return result
}
export function supportId(value, field = 'id') {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) ||
      !Number.isSafeInteger(Number(value))) throw invalid(field)
  return String(value)
}
export function validateSupportTicket(body) {
  object(body, ['request_id', 'category', 'subject', 'description', 'language', 'salon_id', 'context'], 'body')
  if (typeof body.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) throw invalid('request_id')
  if (!SUPPORT_CATEGORIES.includes(body.category)) throw invalid('category')
  if (!['hr', 'en'].includes(body.language)) throw invalid('language')
  const context = body.context ?? {}
  object(context, ['page', 'app_version'], 'context')
  const page = context.page ?? 'other', version = context.app_version ?? null
  if (!SUPPORT_PAGES.includes(page)) throw invalid('context.page')
  if (version !== null && (typeof version !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(version))) throw invalid('context.app_version')
  return {
    request_id: body.request_id.toLowerCase(),
    category: body.category,
    subject: text(body.subject, SUPPORT_LIMITS.subjectMin, SUPPORT_LIMITS.subjectMax, 'subject'),
    description: text(body.description, SUPPORT_LIMITS.descriptionMin, SUPPORT_LIMITS.descriptionMax, 'description', true),
    language: body.language,
    salon_id: body.salon_id == null ? null : supportId(body.salon_id, 'salon_id'),
    context: {page, app_version: version},
  }
}
// Stable hash of normalized content; request_id is the idempotency key, not content.
// S1B must scope request_id by authenticated user and compare this hash on replay.
export function supportRequestHash(body) {
  const {request_id, ...content} = validateSupportTicket(body)
  return createHash('sha256').update(JSON.stringify(content)).digest('hex')
}
export function validateSupportListQuery(query) {
  object(query, ['before'], 'query')
  return {before: query.before === undefined ? null : supportId(query.before, 'before'), limit: SUPPORT_LIMITS.pageSize}
}
