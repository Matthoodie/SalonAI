import {serviceMessages} from './serviceMessages.js'
import {flowText,flowError} from './flowText.js'
export function serviceText(language,source) {
 if (typeof source !== 'string') return ''
 const key=source.trim().replace(/\s+/g,' ')
 if (language==='en' && Object.hasOwn(serviceMessages,key)) return source.match(/^\s*/)[0]+serviceMessages[key]+source.match(/\s*$/)[0]
 return flowText(language,source)
}
export function serviceError(language,error) {
 if (Array.isArray(error)) return error.filter(Boolean).map(value=>serviceError(language,value)).join(' ')
 const source=typeof error==='string'?error:error?.message
 const aliases={'Failed to load services.':'Podaci salona nisu učitani. Pokušajte ponovno.','Failed to create service.':'Uslugu trenutno nije moguće kreirati.','Failed to update service.':'Uslugu trenutno nije moguće urediti.','Failed to update service status.':'Status usluge trenutno nije moguće promijeniti.'}
 const value=Object.hasOwn(aliases,source||'')?aliases[source]:source
 return Object.hasOwn(serviceMessages,value?.trim()||'') ? serviceText(language,value) : flowError(language,error)
}
export function importReviewText(language,ready,needsReview) {
 return language==='en'?`Ready: ${ready}. To complete or review: ${needsReview}.`:`Spremno: ${ready}. Za dopunu ili pregled: ${needsReview}.`
}
export function servicePrice(language,price) {
 return new Intl.NumberFormat(language==='en'?'en-GB':'hr-HR',{style:'currency',currency:'EUR'}).format(price)
}
