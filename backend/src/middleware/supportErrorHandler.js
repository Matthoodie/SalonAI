const codes = Object.freeze({
  SUPPORT_OPERATOR_FORBIDDEN: 403, SUPPORT_REVISION_CONFLICT: 409, SUPPORT_STATUS_UNCHANGED: 409,
  SUPPORT_VALIDATION_ERROR: 400, SUPPORT_FORBIDDEN: 403, SUPPORT_SALON_FORBIDDEN: 403,
  SUPPORT_REQUEST_CONFLICT: 409, SUPPORT_RATE_LIMITED: 429, SUPPORT_NOT_FOUND: 404,
  UNAUTHENTICATED: 401, USER_INACTIVE: 403, SUPPORT_CONTENT_TYPE: 415,
})
export function supportNoStore(req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}
// Do not forward errors containing ticket text or SQL parameters to the global logger.
export function supportErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  let code = error.code, status = codes[code]
  if (error.type === 'entity.too.large') { code = 'SUPPORT_BODY_TOO_LARGE'; status = 413 }
  if (error.type === 'entity.parse.failed') { code = 'SUPPORT_INVALID_JSON'; status = 400 }
  if (error.status === 415) { code = 'SUPPORT_CONTENT_TYPE'; status = 415 }
  if (!status) {
    code = 'SUPPORT_INTERNAL_ERROR'; status = 500
    console.error('Support request failed (details omitted).')
  }
  res.set('Cache-Control', 'no-store')
  if (status === 429) res.set('Retry-After', '3600')
  const response = {code, message: 'Support request could not be processed.'}
  if (code === 'SUPPORT_VALIDATION_ERROR' && typeof error.field === 'string') response.field = error.field
  return res.status(status).json({error: response})
}
