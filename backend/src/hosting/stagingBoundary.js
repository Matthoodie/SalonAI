import { inspectStagingConfiguration } from '../utils/stagingConfiguration.js'

export function createStagingBoundary({ env, getAuth, authenticate, health, isStopping = () => false }) {
  const report = inspectStagingConfiguration(env)
  if (!report.ok) throw new Error('STAGING_CONFIGURATION_INVALID')
  const origin = report.summary.application_origin
  const allowed = new Set(env.STAGING_ALLOWED_CLERK_USER_IDS.split(',').map(x => x.trim()))
  const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
  const headers = new Set(['authorization', 'content-type', 'x-salon-id'])
  const deny = (res, status, code) => res.status(status).json({ error: { code } })

  return async function stagingBoundary(req, res, next) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Vary', 'Origin')
    if (isStopping()) return deny(res, 503, 'STAGING_UNAVAILABLE')
    // Only the exact health path is public; no business API bypass.
    if (req.url === '/healthz' && ['GET', 'HEAD'].includes(req.method)) {
      try {
        if (!await health()) return deny(res, 503, 'STAGING_UNAVAILABLE')
        return res.status(200).json({ status: 'ok' })
      } catch { return deny(res, 503, 'STAGING_UNAVAILABLE') }
    }
    const requestOrigin = req.headers.origin
    if (requestOrigin !== undefined && requestOrigin !== origin) {
      return deny(res, 403, 'STAGING_ORIGIN_DENIED')
    }
    if (requestOrigin === origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    if (req.method === 'OPTIONS') {
      const requested = String(req.headers['access-control-request-headers'] || '')
        .split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
      if (requestOrigin !== origin ||
          !methods.has(req.headers['access-control-request-method']) ||
          requested.some(x => !headers.has(x))) {
        return deny(res, 403, 'STAGING_PREFLIGHT_DENIED')
      }
      res.setHeader('Access-Control-Allow-Methods', [...methods].join(', '))
      res.setHeader('Access-Control-Allow-Headers', [...headers].join(', '))
      return res.status(204).end()
    }
    // Token format alone never grants access: Clerk must verify it below.
    if (!/^Bearer [^\s,]+$/i.test(req.headers.authorization || '')) {
      return deny(res, 401, 'UNAUTHENTICATED')
    }
    const afterAuthentication = (error) => {
      if (error) return deny(res, 401, 'UNAUTHENTICATED')
      try {
        const auth = getAuth(req)
        if (auth?.isAuthenticated !== true || !auth.userId || !auth.sessionId) {
          return deny(res, 401, 'UNAUTHENTICATED')
        }
        if (!allowed.has(auth.userId)) return deny(res, 403, 'STAGING_ACCESS_DENIED')
        return next()
      } catch { return deny(res, 401, 'UNAUTHENTICATED') }
    }
    try {
      await authenticate(req, res, afterAuthentication)
    } catch {
      if (!res.headersSent) return deny(res, 401, 'UNAUTHENTICATED')
      res.end()
    }
  }
}
