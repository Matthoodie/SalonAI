import {supportId} from './supportTicketValidation.js'
export const MAX_DELIVERY_ATTEMPTS = 3
export function deliveryEmail(value) {
 return typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value)
}
export function deliveryRequest({eventId,authorId,activationAfter,allowedRecipient}={}) {
 if (typeof activationAfter !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(activationAfter) || !Number.isFinite(Date.parse(activationAfter)) || !deliveryEmail(allowedRecipient)) throw Error('Invalid delivery selection.')
 return {eventId:supportId(eventId),authorId:supportId(authorId),activationAfter:new Date(activationAfter).toISOString(),allowedRecipient}
}
export function contactMatches(contact, subject, recipient) {
 return contact?.verified === true && contact.subject === subject && deliveryEmail(contact.email) && contact.email === recipient
}
export function safeDeliveryOutcome(result) {
 if (result?.outcome === 'accepted' && typeof result.providerId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(result.providerId)) return {outcome:'accepted',providerId:result.providerId}
 if (['rejected','rate_limited','blocked','disabled'].includes(result?.outcome)) return {outcome:result.outcome,providerId:null}
 return {outcome:'unknown',providerId:null}
}
