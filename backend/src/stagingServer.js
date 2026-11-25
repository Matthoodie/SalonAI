// Render entry point. Deliberately does not load dotenv or run migrations.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inspectStagingConfiguration } from './utils/stagingConfiguration.js'

const report = inspectStagingConfiguration(process.env)
const backendEnv = fileURLToPath(new URL('../.env', import.meta.url))
if (!report.ok || existsSync('.env') || existsSync(backendEnv)) {
  console.error(JSON.stringify({ error: 'STAGING_START_REJECTED', codes: report.errors,
    local_env_file_present: existsSync('.env') || existsSync(backendEnv) }))
  process.exit(1)
}

let pool
try {
  const [{ default: express }, { clerkMiddleware, getAuth }, { createStagingBoundary },
    { startStagingHttp }, { default: databasePool }] = await Promise.all([
    import('express'), import('@clerk/express'), import('./hosting/stagingBoundary.js'),
    import('./hosting/stagingLifecycle.js'), import('./database/pool.js'),
  ])
  pool = databasePool
  pool.options.connectionTimeoutMillis = 3000
  pool.options.max = 5
  // Suppress raw connection details in the legacy pool's error listener on staging.
  pool.removeAllListeners('error')
  pool.on('error', () => console.error('STAGING_DATABASE_POOL_ERROR'))
  const health = async () => {
    const result = await pool.query({
      text: 'SELECT current_database() AS database_name',
      query_timeout: 3000,
    })
    return result.rows[0]?.database_name === 'zrihtan_staging'
  }
  if (!await health()) throw new Error('STAGING_DATABASE_MISMATCH')
  const { default: businessApp } = await import('./app.js')
  const app = express()
  app.disable('x-powered-by')
  app.use(createStagingBoundary({
    env: process.env, getAuth, health,
    authenticate: clerkMiddleware({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      authorizedParties: [report.summary.application_origin],
    }),
  }))
  app.use(businessApp)
  app.use((error, req, res, next) => {
    if (res.headersSent) return res.end()
    res.status(500).json({ error: { code: 'STAGING_REQUEST_FAILED' } })
  })
  await startStagingHttp({ app, pool, port: report.summary.port })
} catch {
  console.error('STAGING_START_FAILED')
  if (pool) {
    const deadline = setTimeout(() => process.exit(1), 5000)
    deadline.unref()
    try { await pool.end() } catch {}
    clearTimeout(deadline)
  }
  process.exit(1)
}
