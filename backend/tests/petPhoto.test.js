import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { photoKind, photoRevision, photoVersion, MAX_PET_PHOTO_BYTES } from '../src/utils/petPhoto.js'
import { processPetPhoto } from '../src/services/petPhotoImageService.js'
test('photo: revision requires a single strong numeric If-Match', () => {
  assert.equal(photoRevision('"1"'), 1)
  for (const x of [undefined, '1', '"0"', '"01"', '*', 'W/"1"', '"1", "2"', '"2147483647"']) assert.throws(() => photoRevision(x))
  assert.equal(photoVersion('2147483647'), 2147483647)
  for (const x of [undefined, ['1'], '01', '0', '-1', '2147483648']) assert.throws(() => photoVersion(x))
})
test('photo: signature and byte limits reject unsupported and forged inputs', () => {
  for (const x of [null, '', Buffer.alloc(0), Buffer.from('<svg></svg>'), Buffer.from('%PDF-1.7'), Buffer.from('GIF89a')]) assert.throws(() => photoKind(x))
  assert.throws(() => photoKind(Buffer.alloc(MAX_PET_PHOTO_BYTES + 1)), { code: 'PET_PHOTO_TOO_LARGE' })
  assert.equal(photoKind(Buffer.from([255,216,255,0])), 'jpeg')
})
test('photo: PNG decodes to bounded JPEG and preserves aspect ratio', async () => {
  const input = await sharp({ create: { width: 1600, height: 800, channels: 4, background: '#44aa88aa' } }).png().toBuffer()
  const output = await processPetPhoto(input), meta = await sharp(output.bytes).metadata()
  assert.equal(meta.format, 'jpeg'); assert.equal(output.width, 768); assert.equal(output.height, 384)
  assert.equal(meta.width, 768); assert.equal(meta.hasAlpha, false); assert.ok(output.bytes.length < 524288)
})
test('photo: EXIF orientation is applied and metadata removed without upscaling', async () => {
  const input = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#aa3344' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
  assert.ok((await sharp(input).metadata()).exif)
  const output = await processPetPhoto(input), meta = await sharp(output.bytes).metadata()
  assert.equal(output.width, 40); assert.equal(output.height, 80)
  assert.equal(meta.exif, undefined); assert.equal(meta.orientation, undefined); assert.equal(meta.icc, undefined)
})
test('photo: truncated JPEG and over-24-megapixel PNG fail decoding', async () => {
  await assert.rejects(processPetPhoto(Buffer.from([255,216,255,0])), { code: 'PET_PHOTO_INVALID' })
  const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#ffffff' } }).png().toBuffer()
  await assert.rejects(processPetPhoto(huge), { code: 'PET_PHOTO_INVALID' })
})
test('photo: APNG animation chunk is rejected even if decoder supports only first frame', () => {
  const bytes = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from([0,0,0,8]), Buffer.from('acTL'), Buffer.alloc(12)])
  assert.throws(() => photoKind(bytes), { code: 'PET_PHOTO_INVALID' })
})
