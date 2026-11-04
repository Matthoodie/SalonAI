import test from 'node:test'
import assert from 'node:assert/strict'
import {creationErrors,stepErrors,serviceExamples} from '../src/components/Onboarding/onboardingPresentation.js'
test('onboarding fields: whitespace name and invalid zone identify specific controls',()=>{
 assert.deepEqual(Object.keys(creationErrors({name:'  ',timezone:'Europe/Unknown',business_type:'grooming'})),['name','timezone'])
 assert.deepEqual(creationErrors({name:'Šapica',timezone:'Europe/Zagreb',business_type:'grooming'}),{})
})
test('onboarding steps: incomplete team cannot be bypassed by opening review',()=>{
 const p=stepErrors({business_type:'grooming',team_mode:null,owner_provides_services:null},[],[],4)
 assert.deepEqual(Object.keys(p),['team_mode','owner_provides_services','profiles','services'])
})
test('onboarding steps: solo and team preserve distinct performer rules',()=>{
 const solo={business_type:'grooming',team_mode:'solo',owner_provides_services:false}
 assert.ok(stepErrors(solo,[{active:true}],[{active:true}],4).owner_provides_services)
 assert.ok(stepErrors({...solo,owner_provides_services:true},[{active:true},{active:true}],[{active:true}],4).profiles)
 assert.deepEqual(stepErrors({...solo,team_mode:'team'},[{active:true}],[{active:true}],4),{})
})
test('onboarding steps: archived profiles and services do not satisfy required setup',()=>{
 const p=stepErrors({business_type:'hair',team_mode:'team',owner_provides_services:true},[{active:false}],[{active:false}],4)
 assert.deepEqual(Object.keys(p),['profiles','services'])
})
test('onboarding examples: grooming uses pet examples; mixed and missing type remain neutral',()=>{
 assert.match(serviceExamples('grooming').name,/psa/)
 for(const type of [undefined,'other','mixed']) assert.doesNotMatch(serviceExamples(type).name,/Muško|psa/)
 assert.match(serviceExamples('hair').name,/šišanje/)
})
