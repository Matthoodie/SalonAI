import { createHash } from 'node:crypto'
import { supportId } from './supportTicketValidation.js'
export const SUPPORT_STATUSES = Object.freeze(['open', 'pending', 'resolved', 'closed'])
export function operationError(code, statusCode = 400) {
  return Object.assign(new Error('Support operation could not be processed.'), {code, statusCode})
}
function invalid() { throw operationError('SUPPORT_VALIDATION_ERROR') }
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).some(key => !allowed.includes(key))) invalid()
}
export function operationQuery(query = {}, messages = false) {
  object(query, messages ? ['after'] : ['before', 'status'])
  const key = messages ? 'after' : 'before'
  const cursor = query[key] === undefined ? null : supportId(query[key])
  if (query.status !== undefined && !SUPPORT_STATUSES.includes(query.status)) invalid()
  return {cursor, status: query.status ?? null, limit: messages ? 50 : 20}
}
export function supportOperation(body) {
  object(body, ['request_id', 'expected_revision', 'kind', 'body', 'status'])
  if (typeof body.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) invalid()
  if (!Number.isInteger(body.expected_revision) || body.expected_revision < 1 || body.expected_revision >= 2147483647) invalid()
  if (!['reply', 'status'].includes(body.kind)) invalid()
  if (body.status !== undefined && !SUPPORT_STATUSES.includes(body.status)) invalid()
  let text = null
  if (body.kind === 'reply') {
    if (typeof body.body !== 'string' || body.body.length > 10100) invalid()
    text = body.body.replace(/\r\n/g, '\n').trim()
    if (Array.from(text).length < 1 || Array.from(text).length > 5000 ||
        /[\u0000-\u0008\u000B-\u001F\u007F]/.test(text) ||
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text)) invalid()
  } else if (body.body !== undefined || body.status === undefined) invalid()
  return {request_id: body.request_id.toLowerCase(), expected_revision: body.expected_revision,
    kind: body.kind, body: text, status: body.status ?? null}
}
export function operationHash(ticketId, draft) {
  const {request_id, ...content} = draft
  return createHash('sha256').update(JSON.stringify({ticket_id: supportId(ticketId), ...content})).digest('hex')
}
