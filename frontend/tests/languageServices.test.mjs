import test from 'node:test'
import assert from 'node:assert/strict'
import {serviceText,serviceError,servicePrice,importReviewText} from '../src/components/Language/serviceText.js'
import {serviceExamples} from '../src/components/Onboarding/onboardingPresentation.js'
import {selectedPayload,fingerprint,reviewIsCurrent,createPendingStore} from '../src/components/ServiceImport/pricelistDraft.js'

test('language services: examples stay specific to business type',()=>{
 assert.match(serviceText('en',serviceExamples('grooming').name),/Dog bath/)
 assert.match(serviceText('en',serviceExamples('grooming').category),/Dog grooming/)
 assert.match(serviceText('en',serviceExamples('hair').name),/haircut/)
 assert.match(serviceText('en',serviceExamples('other').name),/Basic treatment/)
 assert.equal(serviceText('hr',serviceExamples('grooming').name),serviceExamples('grooming').name)
})
test('language services: euro presentation changes locale without conversion',()=>{
 assert.match(servicePrice('en',25.5),/€25\.50/)
 assert.match(servicePrice('hr',25.5),/25,50.*€/)
 assert.match(servicePrice('en',0),/€0\.00/)
 assert.match(servicePrice('hr',1234.56),/1\.234,56/)
})
test('language services: pending confirmation and review are independent of UI language',()=>{
 const rows=[{row_id:'item-1',selected:true,name:'Usluge',category:'Ostalo',price_eur:'25,50',default_duration_minutes:'45',allow_duplicate:true}]
 const payload=selectedPayload(rows),before=structuredClone(payload)
 const review={fingerprint:fingerprint(payload),data:{rows:[{ready:true}]}}
 const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)}
 const store=createPendingStore(storage,7,12),request={...payload,request_id:'73b71815-407a-4c79-a75c-11c0d9e8303e'}
 store.write(request)
 for(const language of ['en','hr','en']){
  serviceText(language,'Potvrdi uvoz (');importReviewText(language,1,0)
  assert.deepEqual(selectedPayload(rows),before);assert.equal(reviewIsCurrent(review,selectedPayload(rows)),true);assert.deepEqual(store.read(),request)
 }
})
test('language services: uncertain save retains both warning and error, with no rollback claim',()=>{
 const err=Object.assign(new TypeError('Failed to fetch'),{code:'NETWORK_ERROR'})
 const messages=['Spremanje nije potvrđeno. Stavke su zaključane kako se isti uvoz ne bi poslao pod novom oznakom.',err]
 assert.match(serviceError('en',messages),/Saving has not been confirmed.*could not be confirmed/)
 assert.match(serviceError('hr',messages),/Spremanje nije potvrđeno.*Radnju nije moguće potvrditi/)
 assert.equal(err.code,'NETWORK_ERROR');assert.equal(err.message,'Failed to fetch')
})
test('language services: known review errors translate while preserving the source',()=>{
 const issue={field:'price_eur',code:'INVALID_PRICE',message:'Unesite jednu cijenu u eurima, s najviše dvije decimale.'}
 const original=structuredClone(issue)
 assert.match(serviceError('en',issue.message),/single price in euros/)
 assert.equal(serviceError('hr',issue.message),issue.message);assert.deepEqual(issue,original)
 assert.match(serviceError('en','Pronađene su moguće duple usluge. Ponovno pregledajte nacrt i potvrdite ili uklonite podudaranja.'),/duplicate services/)
})
test('language services: unknown and prototype-like errors remain safe neutral messages',()=>{
 for(const source of ['constructor','__proto__','<script>text</script>']){
  assert.equal(serviceText('en',source),source)
  assert.match(serviceError('en',new Error(source)),/could not be confirmed/)
 }
 assert.equal(serviceText('en',undefined),'')
 assert.equal(serviceText('en','  Dodaj uslugu '),'  Add service ')
 assert.match(serviceError('hr',new Error('Failed to create service.')),/Uslugu trenutno/)
})
test('language services: dynamic review counts and storage failure messages remain accurate',()=>{
 assert.equal(importReviewText('en',2,3),'Ready: 2. To complete or review: 3.')
 assert.equal(importReviewText('hr',2,3),'Spremno: 2. Za dopunu ili pregled: 3.')
 assert.match(serviceError('en','Preglednik nije sačuvao potvrdu uvoza. Spremanje nije poslano.'),/save request was not sent/)
 assert.match(serviceError('en','Uvoz je spremljen, ali preglednik nije uklonio oznaku prethodne potvrde. Pri ponovnom otvaranju može se ponovno provjeriti isti uvoz.'),/import was saved/)
})
