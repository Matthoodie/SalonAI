import test from 'node:test'
import assert from 'node:assert/strict'
import {flowMessages} from '../src/components/Language/flowMessages.js'
import {flowText,flowError,flowStepTitle} from '../src/components/Language/flowText.js'
import {creationErrors,stepErrors,serviceExamples} from '../src/components/Onboarding/onboardingPresentation.js'

test('language flow: complete HR/EN catalogue and deterministic unsupported-language fallback',()=>{
 for(const [key,pair] of Object.entries(flowMessages)){
  assert.ok(pair.hr.trim());assert.ok(pair.en.trim());assert.deepEqual(Object.keys(pair).sort(),['en','hr'])
  assert.equal(flowText('en',key),pair.en);assert.equal(flowText('hr',key),pair.hr);assert.equal(flowText('unknown',key),pair.hr)
 }
})
test('language flow: all creation errors follow selected language without changing draft',()=>{
 const draft={name:' ',business_type:'invalid',timezone:'invalid/timezone'};const before=structuredClone(draft)
 const errors=creationErrors(draft)
 assert.equal(Object.keys(errors).length,3)
 for(const message of Object.values(errors)){assert.ok(Object.hasOwn(flowMessages,message));assert.notEqual(flowText('en',message),message);assert.equal(flowText('hr',message),message)}
 assert.deepEqual(draft,before)
 assert.ok(Object.hasOwn(flowMessages,creationErrors({...draft,timezone:''}).timezone))
})
test('language flow: team, service and readiness validation remain unchanged',()=>{
 const scenarios=[{},{business_type:'grooming',team_mode:'solo',owner_provides_services:false},{business_type:'hair',team_mode:'team',owner_provides_services:true}]
 for(const draft of scenarios)for(const employees of [[],[{active:true}],[{active:true},{active:true}]]){
  const errors=stepErrors(draft,employees,[],4)
  for(const message of Object.values(errors))assert.ok(Object.hasOwn(flowMessages,message),message)
 }
 const complete={business_type:'grooming',team_mode:'solo',owner_provides_services:true}
 assert.deepEqual(stepErrors(complete,[{active:true}],[{active:true}],4),{})
})
test('language flow: grooming examples stay business-specific',()=>{
 assert.match(flowText('en',serviceExamples('grooming').summary),/dog/)
 assert.doesNotMatch(flowText('en',serviceExamples('grooming').summary),/hair colouring/)
 assert.match(flowText('en',serviceExamples('hair').summary),/hair colouring/)
 assert.match(flowText('en',serviceExamples('other').summary),/services you provide/)
})
test('language flow: stored errors retranslate, preserve suffix and do not claim rollback',()=>{
 const error=Object.assign(new Error('Postavljanje je promijenjeno. Ponovno učitajte pregled.'),{statusCode:409,code:'SALON_SETUP_VERSION_CONFLICT'})
 const stored=[error,'Učitajte spremljeno postavljanje prije nastavka.']
 assert.match(flowError('en',stored),/Setup has changed.*Load the saved setup/)
 assert.match(flowError('hr',stored),/Postavljanje je promijenjeno.*Učitajte spremljeno/)
 assert.equal(error.statusCode,409);assert.equal(error.code,'SALON_SETUP_VERSION_CONFLICT')
 const uncertain=flowError('en',[new TypeError('Failed to fetch'),'Ako rezultat nije potvrđen, osvježite dostupne salone. Ponovni pokušaj šalje isti spremljeni zahtjev.'])
 assert.match(uncertain,/could not be confirmed/);assert.match(uncertain,/same saved request/)
})
test('language flow: unknown and prototype-like messages are safe plain-text fallbacks',()=>{
 for(const text of ['constructor','__proto__','<script>bad()</script>']){
  assert.equal(flowText('en',text),text)
  assert.match(flowError('en',new Error(text)),/could not be confirmed/)
 }
 assert.equal(flowText('en',undefined),'')
 assert.equal(flowText('en','  Natrag '),'  Back ')
})
test('language flow: step titles localize without changing step identifiers',()=>{
 assert.equal(flowStepTitle('en','Tim',2,5),'Team — step 2 of 5')
 assert.equal(flowStepTitle('hr','Tim',2,5),'Tim — korak 2 od 5')
})
