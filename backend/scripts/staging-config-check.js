import { inspectStagingConfiguration } from '../src/utils/stagingConfiguration.js'

// No dotenv import: never silently reads or changes local DEV/TEST configuration.
const args = process.argv.slice(2)
if (args.length !== 1 || !['--help', '--check-env'].includes(args[0])) {
  console.error('Usage: node scripts/staging-config-check.js --help | --check-env')
  process.exitCode = 2
} else if (args[0] === '--help') {
  console.log('ZRIHTAN staging configuration check (offline).')
  console.log('--check-env reads only the current process environment; no files or network.')
  console.log('Required: APP_ENV, NODE_ENV, DATABASE_URL, STAGING_APP_ORIGIN,')
  console.log('CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, VITE_CLERK_PUBLISHABLE_KEY,')
  console.log('STAGING_ALLOWED_CLERK_USER_IDS. Optional: PORT.')
  console.log('This command does not start a server, migrate a database or authorize a deploy.')
} else {
  const result = inspectStagingConfiguration(process.env)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.ok ? 0 : 1
}
