import { parentPort, workerData } from 'node:worker_threads'
import sharp from 'sharp'
sharp.cache(false)
sharp.concurrency(1)
try {
  const source = sharp(Buffer.from(workerData.bytes), { limitInputPixels: 24000000, failOn: 'warning', animated: false })
  const metadata = await source.metadata()
  if (!['jpeg', 'png'].includes(metadata.format) || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height) throw Error('Invalid image')
  const { data, info } = await source.rotate().resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 82, progressive: true }).toBuffer({ resolveWithObject: true })
  if (data.length > 524288) throw Error('Output too large')
  // Re-encoding without keepMetadata strips EXIF/GPS and the original filename.
  parentPort.postMessage({ ok: true, bytes: data, width: info.width, height: info.height })
} catch { parentPort.postMessage({ ok: false }) }
