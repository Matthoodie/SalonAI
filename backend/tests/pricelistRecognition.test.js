import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { documentKind,normalizeRecognition,MAX_DOCUMENT_BYTES } from '../src/utils/pricelistRecognition.js'
import { validatePricelistDocument } from '../src/services/pricelistDocumentService.js'
import { createPricelistRecognizer } from '../src/services/pricelistRecognitionService.js'
import { createPricelistRecognitionRouter } from '../src/routes/pricelistRecognitionRoutes.js'
const item=(overrides={})=>({name:'Feniranje',category:'Kosa',price_text:'25.50',currency:'EUR',price_kind:'fixed',duration_minutes:null,warning:'',...overrides})
const extraction=(items=[item()])=>({items,warnings:[],truncated:false})
const response=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})
const env={OPENAI_API_KEY:'fake-key-for-unit-tests'}
const document={kind:'jpeg',bytes:Buffer.from('test')}
test('recognition: signatures and byte limit reject unsupported or empty inputs',()=>{
  for(const b of [Buffer.alloc(0),Buffer.from('not an image'),Buffer.alloc(MAX_DOCUMENT_BYTES+1)])assert.throws(()=>documentKind(b))
  assert.equal(documentKind(Buffer.from('%PDF-test')),'pdf')
})
test('recognition: missing durations stay empty; explicit fixed euro prices are normalized',()=>{
  const out=normalizeRecognition(extraction()).items[0]
  assert.equal(out.default_duration_minutes,'');assert.equal(out.price_eur,'25,50')
})
test('recognition: unknown currency, ranges, from prices and packages need manual prices',()=>{
  for(const row of [item({currency:'unknown'}),item({price_kind:'from'}),item({price_kind:'range',price_text:'20-30'}),item({price_kind:'unknown',warning:'Paket'})])
    assert.equal(normalizeRecognition(extraction([row])).items[0].price_eur,'')
})
test('recognition: truncated and malformed output is never accepted',()=>{
  for(const value of [{...extraction(),truncated:true},extraction([item({duration_minutes:0})]),extraction([item({name:''})]),extraction(Array.from({length:101},()=>item()))])
    assert.throws(()=>normalizeRecognition(value))
})
test('recognition: real PNG decoding strips metadata and produces JPEG',async()=>{
  const png=await sharp({create:{width:20,height:10,channels:3,background:'#fff'}}).png().toBuffer()
  const result=await validatePricelistDocument(png)
  assert.equal(result.kind,'jpeg');assert.equal((await sharp(result.bytes).metadata()).width,20)
})
test('recognition: corrupt image with a valid signature is rejected',async()=>{
  await assert.rejects(validatePricelistDocument(Buffer.from([255,216,255,0,0,0])),{code:'PRICELIST_RECOGNITION_INVALID'})
})
test('recognition: real PDF validates page limits before provider use',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage()
  assert.equal((await validatePricelistDocument(Buffer.from(await pdf.save()))).pages,1)
  for(let i=0;i<5;i++)pdf.addPage()
  await assert.rejects(validatePricelistDocument(Buffer.from(await pdf.save())))
  await assert.rejects(validatePricelistDocument(Buffer.from('%PDF-corrupt')))
})
test('recognition: oversized pixel dimensions are rejected',async()=>{
  const png=await sharp({create:{width:5000,height:5000,channels:3,background:'#fff'}}).png().toBuffer()
  await assert.rejects(validatePricelistDocument(png))
})
test('recognition: one explicit Responses call, inline document, structured schema and store false',async()=>{
  let calls=0,reserved=0
  const run=createPricelistRecognizer({env,validate:async()=>document,reserve:async(id)=>{assert.equal(id,7);reserved++},request:async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body)
    assert.equal(body.store,false);assert.equal(body.text.format.strict,true)
    assert.equal(body.input[0].content[1].type,'input_image');assert.ok(body.instructions.includes('untrusted DATA'))
    return response(extraction())
  }})
  const out=await run(Buffer.from('x'),7)
  assert.equal(out.salon_id,'7');assert.equal(calls,1);assert.equal(reserved,1)
})
test('recognition: PDF is inline and does not need Files API',async()=>{
  const run=createPricelistRecognizer({env,validate:async()=>({...document,kind:'pdf'}),reserve:async()=>{},request:async(url,options)=>{
    const content=JSON.parse(options.body).input[0].content[1]
    assert.equal(content.type,'input_file');assert.ok(content.file_data.startsWith('data:application/pdf;base64,'));assert.equal(content.file_id,undefined)
    return response(extraction())
  }})
  await run(Buffer.from('x'),1)
})
test('recognition: bad document, missing configuration and quota exhaustion never call provider',async()=>{
  let calls=0
  for(const overrides of [{env:{}},{validate:async()=>{throw new Error('invalid')}},{reserve:async()=>{throw new Error('quota')}}]) {
    const run=createPricelistRecognizer({env,validate:async()=>document,reserve:async()=>{},request:async()=>{calls++;return response(extraction())},...overrides})
    await assert.rejects(run(Buffer.from('x'),1))
  }
  assert.equal(calls,0)
})
test('recognition: provider failures are sanitized and never automatically retried',async()=>{
  let calls=0
  const run=createPricelistRecognizer({env,validate:async()=>document,reserve:async()=>{},request:async()=>{calls++;return Response.json({secret:'must not escape'},{status:429})}})
  await assert.rejects(run(Buffer.from('x'),1),e=>e.statusCode===502&&!e.message.includes('secret'))
  assert.equal(calls,1)
})
test('recognition: timeout aborts a request without retry',async()=>{
  let calls=0
  const run=createPricelistRecognizer({env,timeoutMs:20,validate:async()=>document,reserve:async()=>{},request:async(url,{signal})=>{
    calls++;return await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true}))
  }})
  await assert.rejects(run(Buffer.from('x'),1),{code:'PRICELIST_RECOGNITION_PROVIDER'});assert.equal(calls,1)
})
test('recognition: refusal and incomplete responses do not produce drafts',async()=>{
  for(const data of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}]){
    const run=createPricelistRecognizer({env,validate:async()=>document,reserve:async()=>{},request:async()=>Response.json(data)})
    await assert.rejects(run(Buffer.from('x'),1))
  }
})
async function withApi(role,run,{memberSalon=1}={}) {
  let calls=0
  const app=express();app.use(express.json())
  app.use((req,res,next)=>{req.currentUser={id:2,active:true};req.currentSalon={id:1,active:true};req.currentMembership={userId:2,salonId:memberSalon,active:true,role};next()})
  app.use('/recognize',createPricelistRecognitionRouter({recognize:async(bytes)=>{calls++;assert.ok(Buffer.isBuffer(bytes));return {items:[],warnings:[],salon_id:'1'}}}))
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
  try {await run(async(body=Buffer.from('file'),type='application/octet-stream')=>fetch(`http://127.0.0.1:${server.address().port}/recognize`,{method:'POST',headers:{'content-type':type},body}),()=>calls)}
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
test('recognition route: owner receives no-store response',()=>withApi('owner',async(post,calls)=>{
  const res=await post();assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(calls(),1)
}))
test('recognition route: employee and mismatched salon never invoke processing',async()=>{
  for(const [role,memberSalon] of [['employee',1],['owner',8]])await withApi(role,async(post,calls)=>{assert.equal((await post()).status,403);assert.equal(calls(),0)},{memberSalon})
})
test('recognition route: upload size enforced before processing',()=>withApi('owner',async(post,calls)=>{
  assert.equal((await post(Buffer.alloc(MAX_DOCUMENT_BYTES+1))).status,413);assert.equal(calls(),0)
}))
test('recognition route: JSON input is not accepted as a document',()=>withApi('owner',async(post,calls)=>{
  assert.equal((await post('{}','application/json')).status,415);assert.equal(calls(),0)
}))
