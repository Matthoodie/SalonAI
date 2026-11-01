import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/database/pool.js'
import { reservePricelistRecognition } from '../src/repositories/pricelistRecognitionRepository.js'
after(()=>pool.end())
async function fixture(run) {
  const salon=Number((await pool.query("INSERT INTO salons (name,timezone) VALUES ('Recognition quota test','Europe/Zagreb') RETURNING id")).rows[0].id)
  try{await run(salon)}finally{await pool.query('DELETE FROM salons WHERE id=$1',[salon])}
}
test('recognition DB: concurrent reservations enforce salon quota atomically',()=>fixture(async salon=>{
  const results=await Promise.allSettled(Array.from({length:6},()=>reservePricelistRecognition(salon,{salonLimit:2,globalLimit:1000000})))
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2)
  for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.code,'PRICELIST_RECOGNITION_LIMIT')
  assert.equal((await pool.query('SELECT attempts FROM pricelist_recognition_usage WHERE salon_id=$1',[salon])).rows[0].attempts,2)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM services WHERE salon_id=$1',[salon])).rows[0].n,0)
}))
test('recognition DB: exhausted global quota rolls back without a counter row',()=>fixture(async salon=>{
  await assert.rejects(reservePricelistRecognition(salon,{globalLimit:0}),{code:'PRICELIST_RECOGNITION_LIMIT'})
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pricelist_recognition_usage WHERE salon_id=$1',[salon])).rows[0].n,0)
}))
test('recognition DB: previous day does not consume current daily quota',()=>fixture(async salon=>{
  await pool.query("INSERT INTO pricelist_recognition_usage VALUES ($1,(clock_timestamp() AT TIME ZONE 'UTC')::date-1,20)",[salon])
  await reservePricelistRecognition(salon,{salonLimit:1,globalLimit:1000000})
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pricelist_recognition_usage WHERE salon_id=$1',[salon])).rows[0].n,2)
}))
