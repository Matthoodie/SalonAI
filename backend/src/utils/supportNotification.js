import {supportId} from './supportTicketValidation.js'

export function replyNotificationPreview(ticketId, language) {
  const id = supportId(ticketId)
  if (!['hr','en'].includes(language)) throw new Error('Unsupported notification language.')
  return language === 'hr' ? {
    subject: `ZRIHTAN: novi odgovor na prijavu #${id}`,
    text: `Dobili ste odgovor podrške na prijavu #${id}. Prijavite se u ZRIHTAN i otvorite Pomoć i podrška → Moje prijave.`,
  } : {
    subject: `ZRIHTAN: new reply to request #${id}`,
    text: `Support has replied to request #${id}. Sign in to ZRIHTAN and open Help and support → My requests.`,
  }
}

export function notificationPreviewArgs(args) {
  const values = {}
  for (let i=0;i<args.length;i+=2) {
    const key=args[i],value=args[i+1]
    if (!['--database','--before'].includes(key) || key in values || !value || value.startsWith('--')) {
      throw new Error('Use --database DATABASE [--before EVENT_ID]. This command is read-only.')
    }
    values[key]=value
  }
  if (!values['--database'] || !/^[a-zA-Z0-9_-]{1,63}$/.test(values['--database'])) throw new Error('An explicit database name is required.')
  return {database:values['--database'],before:values['--before'] === undefined ? null : supportId(values['--before'])}
}
