import test from 'node:test'
import assert from 'node:assert/strict'
import {overviewText,overviewError,overviewCount,overviewMoney,overviewDate,overviewStatus,overviewRecipient,overviewMissingPrices} from '../src/components/Language/overviewText.js'
import {summarizeAppointments,periodRange} from '../src/pages/Dashboard/dashboardView.js'
test('overview language: Croatian and English appointment counts',()=>{
 for(const [n,hr,en] of [[1,'1 termin','1 appointment'],[11,'11 termina','11 appointments'],[21,'21 termin','21 appointments'],[0,'0 termina','0 appointments']]){assert.equal(overviewCount('hr',n),hr);assert.equal(overviewCount('en',n),en)}
})
test('overview language: EUR formatting preserves cents and currency',()=>{
 assert.match(overviewMoney('en',123456),/€1,234\.56/);assert.match(overviewMoney('hr',123456),/1\.234,56/);assert.match(overviewMoney('en',0),/€0\.00/)
})
test('overview language: calendar dates preserve leap day and DST date',()=>{
 for(const [date,en] of [['2028-02-29','29/02/2028'],['2026-03-29','29/03/2026'],['2026-10-25','25/10/2026'],['2027-01-01','01/01/2027']])assert.equal(overviewDate('en',date),en)
 assert.match(overviewDate('hr','2028-02-29'),/29\.\s*0?2\.\s*2028/)
})
test('overview language: status labels never mutate canonical status',()=>{
 const a=Object.freeze({statusCode:'completed',status:'Završen'});assert.equal(overviewStatus('en',a),'Completed');assert.equal(overviewStatus('hr',a),'Završen');assert.equal(a.statusCode,'completed');assert.equal(overviewStatus('en',{status:'Zakazano'}),'Scheduled')
})
test('overview language: pet owner and breed names stay literal',()=>{
 const a=Object.freeze({recipientType:'pet',petId:8,petName:'Pas',petSpecies:'cat',petBreed:'Druga životinja',clientName:'Nepoznat klijent'})
 assert.equal(overviewRecipient('en',a),'Pas · Cat · Druga životinja — owner: Nepoznat klijent');assert.equal(overviewRecipient('en',{clientName:'Pas'}),'Pas');assert.equal(overviewRecipient('en',{}),'Unknown client')
})
test('overview language: known range errors switch and unknown errors stay neutral',()=>{
 const err=Error('Početni datum mora biti prije završnog datuma ili jednak njemu.');assert.match(overviewError('en',err),/on or before/);assert.equal(overviewError('hr',err),err.message);assert.doesNotMatch(overviewError('en',Error('SECRET SQL details')),/SECRET|SQL/)
})
test('overview language: missing prices are explicit and not payment records',()=>{
 assert.match(overviewMissingPrices('en',1),/1 completed appointment is/);assert.match(overviewMissingPrices('en',2),/2 completed appointments are/);assert.match(overviewText('en','Prema spremljenim cijenama završenih termina; nije evidencija naplate.'),/not a payment record/)
})
test('overview language: formatting leaves DST statistics and rows unchanged',()=>{
 const rows=[{startsAt:'2026-10-25T00:30:00Z',statusCode:'completed',priceCents:1500},{startsAt:'2026-10-25T01:30:00Z',statusCode:'completed',priceCents:null},{startsAt:'2026-10-25T23:30:00Z',statusCode:'confirmed',priceCents:999}];const copy=structuredClone(rows);const range=periodRange('custom','2026-10-25','2026-10-25');const stats=summarizeAppointments(rows,range,'Europe/Zagreb');assert.equal(stats.total,2);assert.equal(stats.valueCents,1500);assert.equal(stats.missingPrices,1);for(const language of ['hr','en']){overviewMoney(language,stats.valueCents);overviewCount(language,stats.total);rows.forEach(row=>overviewStatus(language,row))}assert.deepEqual(rows,copy);assert.deepEqual(summarizeAppointments(rows,range,'Europe/Zagreb'),stats)
})
