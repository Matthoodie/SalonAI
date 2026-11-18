import pool from '../database/pool.js'
import { supportId, validateSupportTicket, supportRequestHash, validateSupportListQuery } from '../utils/supportTicketValidation.js'
import * as repository from '../repositories/supportTicketRepository.js'
export function supportError(code, statusCode) {
  return Object.assign(new Error('Support request could not be processed.'), {code, statusCode})
}
export function createSupportTicketService({dbPool = pool, repo = repository} = {}) {
  async function transaction(userId, write, run) {
    const id = supportId(userId, 'user_id'), db = await dbPool.connect()
    try {
      await db.query('BEGIN')
      // User lock serializes creations, so concurrent submissions cannot bypass the quota.
      const user = await repo.lockSupportUser(db, id, write)
      if (user?.active !== true) throw supportError('SUPPORT_FORBIDDEN', 403)
      const result = await run(db, id)
      await db.query('COMMIT')
      return result
    } catch (error) {
      try { await db.query('ROLLBACK') } catch { /* Preserve original failure. */ }
      throw error
    } finally { db.release() }
  }
  return {
    async create(userId, body) {
      const draft = validateSupportTicket(body), hash = supportRequestHash(draft)
      return transaction(userId, true, async (db, id) => {
        const previous = await repo.findSupportReplay(db, id, draft.request_id)
        if (previous) {
          if (previous.request_hash !== hash) throw supportError('SUPPORT_REQUEST_CONFLICT', 409)
          const {request_hash, ...ticket} = previous
          // Author may still read their own original ticket after leaving its salon.
          return {ticket, replayed: true}
        }
        if (draft.salon_id && !await repo.lockSupportSalonAccess(db, id, draft.salon_id)) throw supportError('SUPPORT_SALON_FORBIDDEN', 403)
        if (!await repo.supportQuotaAvailable(db, id)) throw supportError('SUPPORT_RATE_LIMITED', 429)
        return {ticket: await repo.insertSupportTicket(db, id, draft, hash), replayed: false}
      })
    },
    async list(userId, query = {}) {
      const {before, limit} = validateSupportListQuery(query)
      return transaction(userId, false, async (db, id) => {
        const rows = await repo.listSupportTickets(db, id, before, limit + 1)
        const tickets = rows.slice(0, limit)
        return {tickets, next_before: rows.length > limit ? String(tickets.at(-1).id) : null}
      })
    },
    async detail(userId, ticketId) {
      const tid = supportId(ticketId, 'ticket_id')
      return transaction(userId, false, async (db, id) => {
        const ticket = await repo.findSupportTicket(db, id, tid)
        if (!ticket) throw supportError('SUPPORT_NOT_FOUND', 404)
        return ticket
      })
    },
  }
}
export const supportTicketService = createSupportTicketService()
