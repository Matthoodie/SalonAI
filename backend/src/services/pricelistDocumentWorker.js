import { parentPort, workerData } from 'node:worker_threads'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
try {
  const bytes=Buffer.from(workerData.bytes)
  if (workerData.kind==='pdf') {
    const pdf=await PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true})
    if (pdf.isEncrypted || pdf.getPageCount()<1 || pdf.getPageCount()>5) throw new Error('PDF smije imati najviše 5 stranica i ne smije biti zaštićen lozinkom.')
    parentPort.postMessage({ok:true,kind:'pdf',bytes,pages:pdf.getPageCount()})
  } else {
    const source=sharp(bytes,{limitInputPixels:24000000,failOn:'warning',animated:false})
    const metadata=await source.metadata()
    if (!metadata.width || !metadata.height || (metadata.pages??1)>1) throw new Error('Odaberite običnu fotografiju, bez animacije.')
    const output=await source.rotate().resize({width:3000,height:3000,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer()
    parentPort.postMessage({ok:true,kind:'jpeg',bytes:output,pages:1})
  }
} catch {
  parentPort.postMessage({ok:false})
}
