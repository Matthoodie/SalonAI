import { supportId } from './supportTicketValidation.js'
import { deliveryEmail } from './supportDelivery.js'

const modes = ['start', 'list', 'preview', 'prepare', 'send', 'status']
export function activationDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) throw new Error('Invalid UTC activation timestamp.')
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z')
  const date = new Date(normalized)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized) throw new Error('Invalid UTC activation timestamp.')
  return normalized
}
export function supportDeliveryArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { mode: 'help' }
  const mode = args[0]?.slice(2)
  if (!args[0]?.startsWith('--') || !modes.includes(mode) || args.length % 2 !== 1) throw new Error('Invalid command. Use --help.')
  const values = {}
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i]
    if (!['--database', '--after', '--event', '--author', '--to', '--confirm-event'].includes(key) || Object.hasOwn(values, key)) throw new Error('Unknown or duplicate argument.')
    values[key] = args[i + 1]
  }
  const required = ['--database', ...(mode === 'start' ? [] : mode === 'list' ? ['--after'] :
    mode === 'status' ? ['--event', '--author'] : ['--after', '--event', '--author', '--to']), ...(mode === 'send' ? ['--confirm-event'] : [])]
  if (Object.keys(values).length !== required.length || required.some(k => !values[k])) throw new Error('Missing or unexpected arguments.')
  if (values['--database'] !== 'salonai_dev') throw new Error('Only salonai_dev is allowed.')
  const result = { mode, database: values['--database'] }
  if (values['--after']) result.activationAfter = activationDate(values['--after'])
  if (values['--event']) result.eventId = supportId(values['--event'])
  if (values['--author']) result.authorId = supportId(values['--author'])
  if (values['--to']) {
    if (!deliveryEmail(values['--to'])) throw new Error('Invalid recipient.')
    result.allowedRecipient = values['--to']
  }
  if (mode === 'send' && values['--confirm-event'] !== result.eventId) throw new Error('Event confirmation does not match.')
  return result
}
export function supportDevConnection(env) {
  let url
  try { url = new URL(env.DATABASE_URL) } catch { throw new Error('DEV DATABASE_URL is missing or invalid.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== 'salonai_dev' || env.NODE_ENV === 'production') {
    throw new Error('Only explicit salonai_dev configuration is allowed.')
  }
  // pg connection parameters can override pathname through query parameters.
  for (const key of ['database', 'dbname', 'service', 'servicefile']) if (url.searchParams.has(key)) throw new Error('Database override is not allowed.')
  return { connectionString: env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000,
    statement_timeout: 15000, lock_timeout: 5000, application_name: 'zrihtan-support-dev-cli' }
}
export function deliveryCommandExit(result) {
  if (result.state === 'uncertain' || result.state === 'sending') return 3
  if (['blocked', 'missing', 'rejected', 'suppressed'].includes(result.state) || result.reason === 'before_activation' ||
      result.reason === 'activation_mismatch' || result.reason === 'recipient_mismatch' || result.reason === 'not_prepared') return 2
  return 0
}
