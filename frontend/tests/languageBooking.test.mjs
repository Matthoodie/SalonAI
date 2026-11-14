import test from 'node:test'
import assert from 'node:assert/strict'
import {bookingText,bookingError,bookingPrice,bookingEndTime} from '../src/components/Language/bookingText.js'
import {draftItems,sumItems} from '../src/api/appointmentItemsView.js'
import {recipientPayload} from '../src/api/appointmentRecipientView.js'
test('booking language: controls translate without changing status codes',()=>{
 for(const [hr,en] of [['Spremi promjene','Save changes'],['Spremanje...','Saving...'],['Odustani','Cancel'],['Zaposlenik','Employee'],['Vrijeme','Time'],['Dodaj termin','Add appointment']]){assert.equal(bookingText('en',hr),en);assert.equal(bookingText('hr',hr),hr)}
 assert.equal(bookingText('en','confirmed'),'confirmed')
})
test('booking language: local validation retains literal employee names',()=>{
 const error={kind:'collision',name:'Zaposlenik'};assert.match(bookingError('en',error),/^Zaposlenik already has/);assert.match(bookingError('hr',error),/^Zaposlenik već ima/);assert.deepEqual(error,{kind:'collision',name:'Zaposlenik'})
})
test('booking language: duplicate phone feedback switches without altering client name',()=>{
 const error={kind:'duplicateClient',name:'Novi klijent'};assert.equal(bookingError('en',error),'A client with this phone number already exists: Novi klijent.');assert.match(bookingError('hr',error),/već postoji: Novi klijent/)
})
test('booking language: server conflict code yields local refresh guidance',()=>{
 const err=Object.assign(Error('private database detail'),{code:'APPOINTMENT_RECIPIENT_CONFLICT'});assert.match(bookingError('en',err),/already been changed.*Refresh/);assert.match(bookingError('hr',err),/već su promijenjeni/);assert.doesNotMatch(bookingError('en',err),/private/)
})
test('booking language: unknown transport failures do not claim rollback',()=>{
 const message=bookingError('en',Error('SECRET SQL'));assert.doesNotMatch(message,/SECRET|SQL|rolled back/);assert.match(message,/confirm|refresh/i);assert.equal(bookingError('hr',''),'')
})
test('booking language: pet eligibility errors are specific in both languages',()=>{
 assert.match(bookingError('en',{code:'PET_INACTIVE'}),/archived pet/i);assert.match(bookingError('hr',{code:'PET_INACTIVE'}),/Arhivirani/);assert.match(bookingError('en',{code:'APPOINTMENT_PET_REQUIRED'}),/grooming/)
})
test('booking language: service snapshots names prices and order stay intact',()=>{
 const catalog=[{id:2,name:'Ukloni',active:true,priceCents:3000,defaultDurationMinutes:30},{id:1,name:'Usluga',active:true,priceCents:5000,defaultDurationMinutes:60}];const old=[{service_id:2,name:'Spremi promjene',price_cents:1000,duration_minutes:15}];const items=draftItems([2,1],catalog,old);const before=structuredClone(items);assert.deepEqual(sumItems(items),{priceCents:6000,durationMinutes:75});assert.equal(bookingPrice('en',6000),'€60.00');assert.match(bookingPrice('hr',6000),/60,00/);assert.deepEqual(items,before);assert.equal(items[0].name,'Spremi promjene')
})
test('booking language: next-day preview does not alter time or recipient payload',()=>{
 assert.equal(bookingEndTime('en','00:30 (sljedeći dan)'),'00:30 (next day)');assert.equal(bookingEndTime('hr','00:30 (sljedeći dan)'),'00:30 (sljedeći dan)');assert.equal(bookingEndTime('en','10:00'),'10:00');assert.deepEqual(recipientPayload('pet','12'),{recipient_type:'pet',pet_id:12});assert.deepEqual(recipientPayload('person',null),{recipient_type:'person',pet_id:null})
})
