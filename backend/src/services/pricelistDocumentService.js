import { Worker } from 'node:worker_threads'
import { documentKind, recognitionError } from '../utils/pricelistRecognition.js'
let active=0
export async function validatePricelistDocument(bytes) {
  const kind=documentKind(bytes)
  if (active>=2) throw recognitionError('Obrada dokumenata je zauzeta. Pokušajte kasnije.',429,'PRICELIST_RECOGNITION_BUSY')
  active++
  try {
    return await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./pricelistDocumentWorker.js',import.meta.url),{
        workerData:{bytes,kind},resourceLimits:{maxOldGenerationSizeMb:128},execArgv:[],
      })
      let finished=false
      const finish=(error,value)=>{
        if(finished)return
        finished=true;clearTimeout(timer);worker.terminate().catch(()=>{})
        error?reject(error):resolve(value)
      }
      const invalid=()=>recognitionError('Dokument nije moguće pročitati. Koristite ispravan JPEG/PNG do 24 megapiksela ili nezaštićen PDF s najviše 5 stranica.')
      const timer=setTimeout(()=>finish(invalid()),10000)
      worker.once('message',result=>result.ok?finish(null,{...result,bytes:Buffer.from(result.bytes)}):finish(invalid()))
      worker.once('error',()=>finish(invalid()))
      worker.once('exit',()=>{if(!finished)finish(invalid())})
    })
  } finally {active--}
}
