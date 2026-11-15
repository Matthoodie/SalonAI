import test from 'node:test'
import assert from 'node:assert/strict'
import {clientText as t,clientError,clientDynamic,clientMoney,clientWeight,clientCount} from '../src/components/Language/clientText.js'
import {clientMessages} from '../src/components/Language/clientMessages.js'
import {petDraftErrors,petPayload,PET_SPECIES} from '../src/api/petApi.js'
import {photoFileError} from '../src/api/petPhotoApi.js'
import {HISTORY_STATUSES} from '../src/api/petHistoryApi.js'
import {overviewRecipient} from '../src/components/Language/overviewText.js'
test('clients language: dictionary translates UI only and preserves literal dynamic names',()=>{
 for(const [hr,en] of Object.entries(clientMessages)){assert.equal(t('hr',hr),hr);assert.equal(t('en',hr),en);assert.ok(en.trim())}
 assert.equal(clientDynamic('en','archiveClient','Uredi'), 'Archive client "Uredi"?')
 assert.equal(clientDynamic('en','editPet','Pas'),'Edit pet: Pas')
 assert.match(clientDynamic('en','removePhoto','Mačka'),/Mačka/)
})
test('clients language: visit and appointment counts include Croatian 11 and 21',()=>{
 assert.equal(clientCount('hr',11,'visits'),'11 posjeta');assert.equal(clientCount('hr',21,'visits'),'21 posjet')
 assert.equal(clientCount('en',1,'visits'),'1 visit');assert.equal(clientCount('en',2,'appointments'),'2 appointments')
})
test('clients language: EUR and weights change display without changing numeric values',()=>{
 assert.equal(clientMoney('en',12.5),'€12.50');assert.match(clientMoney('hr',12.5),/12,50/)
 assert.equal(clientMoney('en',null),'—');assert.equal(clientMoney('en',NaN),'—')
 assert.equal(clientWeight('hr',12501),'12,501');assert.equal(clientWeight('en',12501),'12.501')
})
test('clients language: validation errors switch without changing species size or grams',()=>{
 const draft={name:'Pas',species:'cat',breed:'Mala',notes:'Uredi',sizeCategory:'large',weightKg:'12,501'}
 const before=structuredClone(draft);assert.deepEqual(petDraftErrors(draft),{})
 assert.deepEqual(petPayload(draft,2),{name:'Pas',species:'cat',breed:'Mala',notes:'Uredi',size_category:'large',weight_grams:12501,expected_revision:2})
 const errors=petDraftErrors({...draft,name:'',weightKg:'201'});assert.match(clientError('en',errors.name),/Enter the pet/);assert.match(clientError('en',errors.weightKg),/200 kg/)
 assert.deepEqual(draft,before);assert.equal(PET_SPECIES.cat,'Mačka')
})
test('clients language: photo validation retains byte and MIME limits',()=>{
 assert.equal(photoFileError({size:8*1024*1024,type:'image/png'}),'')
 assert.match(clientError('en',photoFileError({size:8*1024*1024+1,type:'image/png'})),/8 MB/)
 assert.match(clientError('en',photoFileError({size:10,type:'image/gif'})),/JPEG or PNG/)
})
test('clients language: history status codes and recipient snapshot names stay unchanged',()=>{
 assert.equal(t('en',HISTORY_STATUSES.cancelled),'Cancelled');assert.equal(HISTORY_STATUSES.completed,'Završeno')
 const a={recipientType:'pet',petId:3,petName:'Pas',petSpecies:'cat',petBreed:'Mala',clientName:'Uredi'}
 assert.equal(overviewRecipient('en',a),'Pas · Cat · Mala — owner: Uredi')
})
test('clients language: known conflicts are localized and unknown errors do not leak details',()=>{
 assert.match(clientError('en',Error('Profil se promijenio. Osvježite popis prije ponovnog spremanja.')),/profile has changed/)
 assert.doesNotMatch(clientError('en',Error('SELECT secret FROM users')),/SELECT|secret|users/)
})
test('clients language: uncertain writes remain uncertain in both languages',()=>{
 const hr='Spremanje nije potvrđeno. Promjena je možda spremljena. Osvježite popis i provjerite stanje prije ponovnog unosa; zahtjev nije automatski ponovljen.'
 assert.equal(clientError('hr',hr),hr);assert.match(clientError('en',hr),/may have been saved/);assert.match(clientError('en',hr),/not retried automatically/)
})
