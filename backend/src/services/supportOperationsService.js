import pool from '../database/pool.js'
import { supportId } from '../utils/supportTicketValidation.js'
import { supportOperation, operationQuery, operationHash, operationError } from '../utils/supportOperations.js'
import { requireSupportAccess } from './supportAccessService.js'
import { lockSupportUser } from '../repositories/supportTicketRepository.js'
import * as repository from '../repositories/supportOperationsRepository.js'
export function createSupportOperationsService({dbPool=pool, repo=repository, authorize=requireSupportAccess, lockAuthor=lockSupportUser} = {}) {
  async function transact(userId, operator, write, run) {
    const id = supportId(userId), db = await dbPool.connect()
    try {
      await db.query('BEGIN')
      let access = null
      if (operator) {
        // Lock order matches S3A revocation: user before access grant before ticket.
        if (write) await repo.lockOperatorActor(db,id)
        access = await authorize(db,id)
      } else if ((await lockAuthor(db,id))?.active !== true) throw operationError('SUPPORT_FORBIDDEN',403)
      const result = await run(db,id,access)
      await db.query('COMMIT')
      return result
    } catch (error) {
      try { await db.query('ROLLBACK') } catch { /* Preserve initial failure. */ }
      throw error
    } finally { db.release() }
  }
  async function getTicket(db,id,actor,operator,write=false) {
    const ticket=await repo.findTicket(db,id,operator ? null : actor,write)
    if (!ticket) throw operationError('SUPPORT_NOT_FOUND',404)
    return ticket
  }
  return {
    access(userId) { return transact(userId,true,false,async () => ({allowed:true})) },
    list(userId,query={}) {
      const page=operationQuery(query)
      return transact(userId,true,false,async(db,id,access)=>{
        const rows=await repo.listTickets(db,page),tickets=rows.slice(0,page.limit)
        await repo.audit(db,id,access.revision,'list')
        return {tickets,next_before:rows.length>page.limit ? String(tickets.at(-1).id) : null}
      })
    },
    detail(userId,ticketId) {
      const tid=supportId(ticketId)
      return transact(userId,true,false,async(db,id,access)=>{
        const ticket=await getTicket(db,tid,id,true)
        await repo.audit(db,id,access.revision,'detail',ticket)
        return ticket
      })
    },
    messages(userId,ticketId,query={},operator=false) {
      const tid=supportId(ticketId),page=operationQuery(query,true)
      return transact(userId,operator,false,async(db,id,access)=>{
        const ticket=await getTicket(db,tid,id,operator)
        const rows=await repo.listMessages(db,tid,page),messages=rows.slice(0,page.limit)
        if (operator) await repo.audit(db,id,access.revision,'messages',ticket)
        return {ticket,messages,next_after:rows.length>page.limit ? String(messages.at(-1).id) : null}
      })
    },
    apply(userId,ticketId,body) {
      const tid=supportId(ticketId),draft=supportOperation(body),hash=operationHash(tid,draft)
      return transact(userId,true,true,async(db,id,access)=>{
        const ticket=await getTicket(db,tid,id,true,true)
        const previous=await repo.findReplay(db,id,draft.request_id)
        if (previous) {
          if (String(previous.ticket_id)!==tid || previous.request_hash!==hash) throw operationError('SUPPORT_REQUEST_CONFLICT',409)
          return {ticket_id:tid,revision:previous.result_revision,status:previous.result_status,message_id:previous.message_id,replayed:true}
        }
        if (ticket.revision!==draft.expected_revision || ticket.revision>=2147483647) throw operationError('SUPPORT_REVISION_CONFLICT',409)
        const status=draft.status ?? ticket.status
        if (draft.kind==='status' && status===ticket.status) throw operationError('SUPPORT_STATUS_UNCHANGED',409)
        if (draft.kind==='reply' && !await repo.replyQuota(db,id)) throw operationError('SUPPORT_RATE_LIMITED',429)
        const messageId=draft.kind==='reply' ? await repo.insertMessage(db,tid,id,draft.body) : null
        const updated=await repo.updateTicket(db,tid,status)
        const result={ticket_id:tid,revision:updated.revision,status:updated.status,message_id:messageId,replayed:false}
        await repo.insertOperation(db,id,tid,draft,hash,result)
        await repo.audit(db,id,access.revision,draft.kind,ticket,result)
        return result
      })
    }
  }
}
export const supportOperationsService=createSupportOperationsService()
