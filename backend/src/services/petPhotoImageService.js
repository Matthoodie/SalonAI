import { Worker } from 'node:worker_threads'
import { photoKind, photoError } from '../utils/petPhoto.js'
let active = 0
export async function processPetPhoto(bytes) {
  photoKind(bytes)
  if (active >= 2) throw photoError('Obrada fotografija je zauzeta. Pokušajte kasnije.', 'PET_PHOTO_BUSY', 429)
  active++
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./petPhotoWorker.js', import.meta.url), {
        workerData: { bytes }, resourceLimits: { maxOldGenerationSizeMb: 128 }, execArgv: [],
      })
      let finished = false
      const invalid = () => photoError('Fotografiju nije moguće obraditi. Odaberite ispravan JPEG/PNG do 24 megapiksela, bez animacije.')
      const finish = async (error, value) => {
        if (finished) return
        finished = true; clearTimeout(timer)
        await worker.terminate().catch(() => {})
        error ? reject(error) : resolve(value)
      }
      const timer = setTimeout(() => finish(invalid()), 10000)
      worker.once('message', value => value.ok ? finish(null, { bytes: Buffer.from(value.bytes), width: value.width, height: value.height }) : finish(invalid()))
      worker.once('error', () => finish(invalid()))
      worker.once('exit', () => { if (!finished) finish(invalid()) })
    })
  } finally { active-- }
}
