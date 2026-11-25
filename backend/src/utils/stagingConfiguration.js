// Offline contract only. The hosted entry point must enforce this contract
// and install the API access gate before any business routes are exposed.
export function inspectStagingConfiguration(env = {}) {
  const errors = []
  const add = (code) => { if (!errors.includes(code)) errors.push(code) }
  if (env.APP_ENV !== 'staging') add('APP_ENV_MUST_BE_STAGING')
  if (env.NODE_ENV !== 'production') add('NODE_ENV_MUST_BE_PRODUCTION')

  let databaseHost = null
  try {
    const db = new URL(env.DATABASE_URL)
    if (!['postgres:', 'postgresql:'].includes(db.protocol)) throw Error()
    if (decodeURIComponent(db.pathname.slice(1)) !== 'zrihtan_staging') throw Error()
    if (!db.username || !db.password || db.hash) throw Error()
    if (db.port && db.port !== '5432') throw Error()
    const internal = /^dpg-[a-z0-9-]+$/.test(db.hostname)
    const external = /^dpg-[a-z0-9-]+\.[a-z0-9-]+-postgres\.render\.com$/.test(db.hostname)
    if (!internal && !external) throw Error()
    for (const key of db.searchParams.keys()) {
      if (key !== 'sslmode') throw Error()
    }
    if (db.searchParams.getAll('sslmode').length > 1) throw Error()
    if (db.searchParams.has('sslmode') &&
        !['require', 'verify-full'].includes(db.searchParams.get('sslmode'))) throw Error()
    databaseHost = internal ? 'render-internal' : 'render-external'
  } catch { add('DATABASE_URL_MUST_TARGET_RENDER_STAGING') }

  let origin = null
  try {
    const url = new URL(env.STAGING_APP_ORIGIN)
    const allowedHost = url.hostname === 'staging.zrihtan.com' ||
      /^[a-z0-9-]+\.onrender\.com$/.test(url.hostname)
    if (url.protocol !== 'https:' || !allowedHost || url.username || url.password ||
        url.port || url.pathname !== '/' || url.search || url.hash) throw Error()
    origin = url.origin
  } catch { add('STAGING_APP_ORIGIN_INVALID') }

  if (!/^sk_test_[A-Za-z0-9_-]+$/.test(env.CLERK_SECRET_KEY || '')) add('CLERK_TEST_SECRET_REQUIRED')
  if (!/^pk_test_[A-Za-z0-9_-]+$/.test(env.CLERK_PUBLISHABLE_KEY || '')) add('CLERK_TEST_PUBLISHABLE_REQUIRED')
  if (env.VITE_CLERK_PUBLISHABLE_KEY !== env.CLERK_PUBLISHABLE_KEY ||
      !env.VITE_CLERK_PUBLISHABLE_KEY) add('CLERK_PUBLISHABLE_KEYS_MUST_MATCH')

  const rawIds = typeof env.STAGING_ALLOWED_CLERK_USER_IDS === 'string'
    ? env.STAGING_ALLOWED_CLERK_USER_IDS.split(',').map(value => value.trim()) : []
  if (!rawIds.length || rawIds.length > 20 || rawIds.some(id => !/^user_[A-Za-z0-9]+$/.test(id)) ||
      new Set(rawIds).size !== rawIds.length) add('STAGING_TESTER_ALLOWLIST_INVALID')

  for (const key of ['RESEND_API_KEY', 'ZRIHTAN_RESEND_API_KEY']) {
    if (env[key]) add('EMAIL_DELIVERY_CREDENTIALS_NOT_ALLOWED_YET')
  }
  if (Object.keys(env).some(key => key.startsWith('VITE_') &&
      /SECRET|PASSWORD|DATABASE|RESEND|TOKEN|PRIVATE|API_KEY/i.test(key))) add('SECRET_IN_FRONTEND_ENVIRONMENT')

  const port = env.PORT === undefined ? 10000 : Number(env.PORT)
  if (env.PORT !== undefined && !/^[0-9]+$/.test(String(env.PORT))) add('PORT_INVALID')
  if (!Number.isInteger(port) || port < 1024 || port > 65535) add('PORT_INVALID')

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    // No credentials, email addresses, user IDs or connection strings returned.
    summary: Object.freeze({
      environment: 'staging',
      database_name: 'zrihtan_staging',
      database_connection: databaseHost,
      application_origin: origin,
      tester_count: errors.includes('STAGING_TESTER_ALLOWLIST_INVALID') ? 0 : rawIds.length,
      port: errors.includes('PORT_INVALID') ? null : port,
      network_requests: 0,
      delivery_enabled: false,
    }),
  })
}
