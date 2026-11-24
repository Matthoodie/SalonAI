import fs from 'node:fs'
import { parseEnv } from 'node:util'
import pg from 'pg'
import { supportDeliveryArgs, supportDevConnection, deliveryCommandExit } from '../src/utils/supportDeliveryCommand.js'
import { executeSupportDeliveryCommand } from '../src/services/supportDeliveryCommandService.js'
import { createSupportClerkContactResolver } from '../src/services/supportClerkContactService.js'
import { createSupportResendTransport } from '../src/services/supportResendTransport.js'

let pool
try {
  const options = supportDeliveryArgs(process.argv.slice(2))
  if (options.mode === 'help') {
    console.log(`Run from backend. Configuration: .env only. No default sending.
--start --database salonai_dev
--list --database salonai_dev --after UTC_TIMESTAMP
--status --database salonai_dev --event EVENT_ID --author AUTHOR_ID
--preview|--prepare --database salonai_dev --after UTC_TIMESTAMP --event EVENT_ID --author AUTHOR_ID --to EMAIL
--send --database salonai_dev --after UTC_TIMESTAMP --event EVENT_ID --author AUTHOR_ID --to EMAIL --confirm-event EVENT_ID
Send requires process-only ZRIHTAN_RESEND_API_KEY. Clerk secret must be sk_test_ in backend .env.
Never include a secret key as a command argument. No production or bulk sending.`)
  } else {
    if (!fs.existsSync('src/server.js')) throw new Error()
    const env = parseEnv(fs.readFileSync('.env', 'utf8'))
    const connection = supportDevConnection(env)
    // Prevent inherited libpq settings from filling missing connection fields.
    for (const key of Object.keys(process.env)) if (key.startsWith('PG')) delete process.env[key]
    pool = new pg.Pool(connection)
    let resolver
    const resolveContact = async subject => {
      if (!resolver) {
        if (!/^sk_test_[A-Za-z0-9_-]+$/.test(env.CLERK_SECRET_KEY ?? '')) throw new Error()
        const { createClerkClient } = await import('@clerk/express')
        const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY,
          apiUrl: 'https://api.clerk.com', apiVersion: 'v1', telemetry: { disabled: true } })
        resolver = createSupportClerkContactResolver({ getUser: id => client.users.getUser(id) })
      }
      return resolver(subject)
    }
    const result = await executeSupportDeliveryCommand({ options, dbPool: pool, resolveContact,
      makeTransport: recipient => createSupportResendTransport({ enabled: true,
        apiKey: process.env.ZRIHTAN_RESEND_API_KEY, allowedRecipients: [recipient] }),
    })
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = deliveryCommandExit(result)
  }
} catch {
  console.error('Support DEV command failed. Check arguments (--help), .env DEV database, migrations and Clerk TEST key. No raw error or secret is printed. If --send was used, inspect --status before any retry; delivery may be uncertain.')
  process.exitCode = 1
} finally {
  if (pool) { try { await pool.end() } catch { process.exitCode = 1 } }
}
