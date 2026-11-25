import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export function verifyStagingMigrationFiles(dir, manifest) {
  if (manifest?.baseline !== 'abf6707' || !Array.isArray(manifest.files) ||
      !manifest.files.length || manifest.files.some(item =>
        !/^\d{13}_[a-z0-9-]+\.js$/.test(item.file) || !/^[a-f0-9]{64}$/.test(item.sha256))) {
    throw Error('STAGING_MIGRATION_MANIFEST_MISMATCH')
  }
  const actual = readdirSync(dir).filter(name => !name.startsWith('.')).sort()
  const expected = manifest.files.map(item => item.file)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('STAGING_MIGRATION_MANIFEST_MISMATCH')
  for (const item of manifest.files) {
    const hash = createHash('sha256').update(readFileSync(join(dir, item.file), 'utf8').replaceAll('\r\n', '\n')).digest('hex')
    if (hash !== item.sha256) throw Error('STAGING_MIGRATION_MANIFEST_MISMATCH')
  }
  return expected.map(name => name.slice(0, -3))
}

// The caller owns this single connected client. Never accept a second connection URL.
const LOCK = '7241865325823964'
const fail = code => { throw new Error(code) }
export function parseStagingMigrationArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { mode: 'help' }
  if (args.length === 1 && args[0] === '--check') return { mode: 'check' }
  if (args.length === 3 && args[0] === '--apply' &&
      args[1] === '--database' && args[2] === 'zrihtan_staging') return { mode: 'apply' }
  fail('MIGRATION_ARGUMENTS_INVALID')
}

export function compareMigrationHistory(expectedNames, appliedNames) {
  if (!Array.isArray(expectedNames) || !expectedNames.length ||
      new Set(expectedNames).size !== expectedNames.length ||
      !Array.isArray(appliedNames) || appliedNames.length > expectedNames.length ||
      appliedNames.some((name, index) => name !== expectedNames[index])) {
    fail('STAGING_MIGRATION_HISTORY_MISMATCH')
  }
  return expectedNames.slice(appliedNames.length)
}

export async function runStagingMigrations({ mode, client, runner, migrationsDir, expectedNames }) {
  if (!['check', 'apply'].includes(mode)) fail('MIGRATION_ARGUMENTS_INVALID')
  let transaction = false
  let locked = false
  let phase = 'preflight'
  try {
    // Only SELECTs in this transaction; --check never invokes node-pg-migrate.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    transaction = true
    const identity = (await client.query(
      "SELECT current_database() AS database_name, current_setting('server_version_num') AS version_num, pg_is_in_recovery() AS recovery"
    )).rows[0]
    if (identity?.database_name !== 'zrihtan_staging') fail('STAGING_DATABASE_MISMATCH')
    if (Math.floor(Number(identity.version_num) / 10000) !== 18) fail('STAGING_POSTGRES_VERSION_MISMATCH')
    if (identity.recovery !== false) fail('STAGING_DATABASE_NOT_PRIMARY')
    const capability = (await client.query(
      "SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage, has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create, has_database_privilege(current_user, current_database(), 'CREATE') AS database_create, EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'btree_gist') AS extension_available, to_regclass('public.pgmigrations') IS NOT NULL AS history_exists"
    )).rows[0]
    if (!capability?.schema_usage || !capability.schema_create || !capability.database_create) fail('STAGING_MIGRATION_PRIVILEGES_MISSING')
    if (!capability.extension_available) fail('STAGING_REQUIRED_EXTENSION_UNAVAILABLE')
    let appliedNames = []
    if (capability.history_exists) {
      appliedNames = (await client.query('SELECT name FROM public.pgmigrations ORDER BY run_on, id')).rows.map(row => row.name)
    } else {
      const result = await client.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f','S')")
      if (result.rows[0]?.count !== 0) fail('STAGING_UNTRACKED_SCHEMA')
    }
    const pending = compareMigrationHistory(expectedNames, appliedNames)
    await client.query('COMMIT')
    transaction = false
    const summary = { database_name: 'zrihtan_staging', mode,
      total: expectedNames.length, applied_before: appliedNames.length,
      pending_count: pending.length, pending, migrated_count: 0 }
    if (mode === 'check') return { ...summary, writes_performed: false }

    // Match the migrator's lock so that the second history read and apply are serialized.
    const lock = (await client.query('SELECT pg_try_advisory_lock(' + LOCK + ') AS locked')).rows[0]
    if (lock?.locked !== true) fail('STAGING_MIGRATION_BUSY')
    locked = true
    // Re-read history under the lock: another process may have completed the same migrations.
    const exists = (await client.query("SELECT to_regclass('public.pgmigrations') IS NOT NULL AS history_exists")).rows[0]
    const currentNames = exists?.history_exists
      ? (await client.query('SELECT name FROM public.pgmigrations ORDER BY run_on, id')).rows.map(row => row.name) : []
    const currentPending = compareMigrationHistory(expectedNames, currentNames)
    if (!currentPending.length) return { ...summary, pending: [], pending_count: 0, applied_before: currentNames.length, migrated_count: 0 }
    phase = 'apply'
    await runner({
      dbClient: client, dir: migrationsDir, direction: 'up',
      migrationsTable: 'pgmigrations', migrationsSchema: 'public', schema: 'public',
      createSchema: false, createMigrationsSchema: false,
      checkOrder: true, singleTransaction: true, noLock: false,
      advisoryLockMode: 'fail', fake: false, dryRun: false, verbose: false,
      logger: { debug() {}, info() {}, warn() {}, error() {} },
    })
    phase = 'verify'
    const finalNames = (await client.query('SELECT name FROM public.pgmigrations ORDER BY run_on, id')).rows.map(row => row.name)
    if (compareMigrationHistory(expectedNames, finalNames).length) fail('STAGING_MIGRATION_POSTCHECK_FAILED')
    return { ...summary, applied_before: currentNames.length,
      pending: currentPending, pending_count: currentPending.length, migrated_count: currentPending.length }
  } catch (error) {
    if (transaction) { try { await client.query('ROLLBACK') } catch {} }
    const known = new Set(['MIGRATION_ARGUMENTS_INVALID', 'STAGING_DATABASE_MISMATCH',
      'STAGING_POSTGRES_VERSION_MISMATCH', 'STAGING_DATABASE_NOT_PRIMARY',
      'STAGING_MIGRATION_PRIVILEGES_MISSING', 'STAGING_REQUIRED_EXTENSION_UNAVAILABLE',
      'STAGING_UNTRACKED_SCHEMA', 'STAGING_MIGRATION_HISTORY_MISMATCH',
      'STAGING_MIGRATION_BUSY', 'STAGING_MIGRATION_POSTCHECK_FAILED'])
    const code = known.has(error.message) ? error.message : 'STAGING_MIGRATION_' + phase.toUpperCase() + '_FAILED'
    throw new Error(code)
  } finally {
    if (locked) {
      // The runner releases its re-entrant lock; release our own lock as well.
      try { await client.query('SELECT pg_advisory_unlock(' + LOCK + ')') } catch {}
    }
  }
}
