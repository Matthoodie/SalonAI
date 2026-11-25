import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectStagingConfiguration } from '../src/utils/stagingConfiguration.js'
import { parseStagingMigrationArgs, runStagingMigrations, verifyStagingMigrationFiles } from '../src/hosting/stagingMigrations.js'

const backend = fileURLToPath(new URL('../', import.meta.url))
let client
let stage = 'arguments'
try {
  const options = parseStagingMigrationArgs(process.argv.slice(2))
  if (options.mode === 'help') {
    console.log('ZRIHTAN staging migrations. Run only on Render with staging environment.')
    console.log('--check : read-only database preflight; no migrations or history table creation.')
    console.log('--apply --database zrihtan_staging : apply reviewed pending UP migrations.')
    console.log('No dotenv, DEV/TEST data copy, down, seed or email sending.')
  } else {
    stage = 'configuration'
    const report = inspectStagingConfiguration(process.env)
    if (!report.ok || report.summary.database_connection !== 'render-internal' ||
        process.env.RENDER !== 'true' || existsSync('.env') || existsSync(join(backend, '.env'))) {
      throw Error('STAGING_MIGRATION_CONFIGURATION_REJECTED')
    }
    stage = 'manifest'
    const manifest = JSON.parse(readFileSync(join(backend, 'src/hosting/stagingMigrationManifest.json'), 'utf8'))
    const dir = join(backend, 'migrations')
    const expectedNames = verifyStagingMigrationFiles(dir, manifest)
    // Only load network-capable dependencies after all local guards passed.
    stage = 'dependency'
    const pkg = JSON.parse(readFileSync(join(backend, 'node_modules/node-pg-migrate/package.json'), 'utf8'))
    if (pkg.version !== '9.0.0') throw Error('STAGING_MIGRATOR_VERSION_MISMATCH')
    const [{ default: pg }, { runner }] = await Promise.all([import('pg'), import('node-pg-migrate')])
    stage = 'connection'
    client = new pg.Client({ connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000, statement_timeout: 120000, lock_timeout: 10000,
      application_name: 'zrihtan-staging-migrations' })
    client.on('error', () => {})
    await client.connect()
    stage = 'migration'
    const result = await runStagingMigrations({
      ...options, client, runner, migrationsDir: dir,
      expectedNames,
    })
    console.log(JSON.stringify(result, null, 2))
  }
} catch (error) {
  // Never serialize arbitrary provider errors or connection strings.
  const safe = /^STAGING_[A-Z_]+$/.test(error.message) || error.message === 'MIGRATION_ARGUMENTS_INVALID'
  console.error(JSON.stringify({ error: safe ? error.message : 'STAGING_MIGRATION_COMMAND_FAILED', stage }))
  process.exitCode = 1
} finally {
  if (client) {
    const timer = setTimeout(() => process.exit(1), 5000)
    timer.unref()
    try { await client.end() } catch { process.exitCode = 1 }
    clearTimeout(timer)
  }
}
