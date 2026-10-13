import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  createBase64ImageAttachment,
  createUniqueFilename,
  getRenderableImageSource,
  inspectImageFile,
  isBase64TextImage,
  isNativeBinaryFile,
  isNativeBinaryImage,
  resolveSiblingImageReference,
  resolveSiblingImageSource
} = require('../../app/utilities/imageAttachments')

const FIXTURES = {
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00],
  jpg: [0xFF, 0xD8, 0xFF, 0xE0, 0x00],
  gif: [...Buffer.from('GIF89a'), 0x00],
  webp: [...Buffer.from('RIFF'), 0x00, 0x00, 0x00, 0x00, ...Buffer.from('WEBP')]
}

function toBase64 (bytes) {
  return Buffer.from(bytes).toString('base64')
}

function createFile (name, bytes, type = '') {
  const value = Uint8Array.from(bytes)
  return {
    name,
    size: value.length,
    type,
    arrayBuffer: async () => value.buffer
  }
}

describe('image attachment utilities', () => {
  it.each([
    ['image.png', FIXTURES.png, 'image/png'],
    ['image.JPG', FIXTURES.jpg, 'image/jpeg'],
    ['image.jpeg', FIXTURES.jpg, 'image/jpeg'],
    ['image.gif', FIXTURES.gif, 'image/gif'],
    ['image.webp', FIXTURES.webp, 'image/webp']
  ])('recognizes valid Base64 image content for %s', (filename, bytes, mediaType) => {
    const content = toBase64(bytes)
    const inspected = inspectImageFile({ filename, content })

    expect(inspected).toMatchObject({
      valid: true,
      kind: 'base64-text',
      mediaType,
      decodedSize: bytes.length
    })
    expect(inspected.dataUrl).toBe(`data:${mediaType};base64,${content}`)
    expect(isBase64TextImage({ filename, content })).toBe(true)
  })

  it('distinguishes GitHub binary transport encoding from Lepton Base64 text', () => {
    const file = {
      filename: 'image.png',
      content: toBase64(FIXTURES.png),
      encoding: 'base64'
    }

    expect(inspectImageFile(file).kind).toBe('github-binary')
    expect(isNativeBinaryFile(file)).toBe(true)
    expect(isNativeBinaryImage(file)).toBe(true)
    expect(isBase64TextImage(file)).toBe(false)
    expect(isNativeBinaryFile({ filename: 'archive.bin', encoding: 'base64' })).toBe(true)
  })

  it('uses a raw URL for a truncated GitHub binary image', () => {
    const file = {
      filename: 'large.png',
      encoding: 'base64',
      truncated: true,
      raw_url: 'https://gist.example/raw/large.png',
      size: 900000
    }

    expect(getRenderableImageSource(file)).toBe(file.raw_url)
    expect(inspectImageFile(file)).toMatchObject({
      valid: true,
      kind: 'github-binary',
      decodedSize: 900000
    })
  })

  it('falls back to a safe raw URL when GitHub omits inline binary content', () => {
    const file = {
      filename: 'native.png',
      encoding: 'base64',
      raw_url: 'https://gist.example/raw/native.png'
    }

    expect(getRenderableImageSource(file)).toBe(file.raw_url)
    expect(getRenderableImageSource(Object.assign({}, file, {
      raw_url: 'javascript:alert(1)'
    }))).toBe(null)
  })

  it.each([
    { filename: 'image.svg', content: toBase64(FIXTURES.png) },
    { filename: 'image.png', content: '' },
    { filename: 'image.png', content: 'data:image/png;base64,AAAA' },
    { filename: 'image.png', content: 'not-base64!' },
    { filename: 'image.png', content: toBase64(FIXTURES.jpg) }
  ])('rejects invalid image content %#', file => {
    expect(inspectImageFile(file).valid).toBe(false)
  })

  it('creates canonical raw Base64 content and enforces the decoded size limit', async () => {
    const attachment = await createBase64ImageAttachment(
      createFile('diagram.png', FIXTURES.png, 'image/png'),
      64
    )

    expect(attachment).toEqual({
      filename: 'diagram.png',
      content: toBase64(FIXTURES.png),
      _imageAttachment: true
    })

    const oversized = createFile('large.png', new Array((64 * 1024) + 1).fill(0), 'image/png')
    await expect(createBase64ImageAttachment(oversized, 64)).rejects.toMatchObject({
      code: 'too-large',
      details: expect.objectContaining({ maxSizeKB: 64, sizeKB: 65 })
    })
  })

  it('rejects a suffix and signature mismatch during ingestion', async () => {
    await expect(createBase64ImageAttachment(
      createFile('photo.png', FIXTURES.jpg, 'image/jpeg'),
      64
    )).rejects.toMatchObject({ code: 'unsupported-type' })
  })

  it('generates case-insensitive collision-safe filenames', () => {
    expect(createUniqueFilename('image.png', ['IMAGE.PNG', 'image-2.png'])).toBe('image-3.png')
    expect(createUniqueFilename('DIAGRAM.PNG', ['diagram.png'])).toBe('DIAGRAM-2.PNG')
    expect(createUniqueFilename('photo.jpg', ['other.jpg'])).toBe('photo.jpg')
  })

  it('resolves safe same-Gist references and rejects unsafe paths', () => {
    const files = {
      'my image.png': {
        filename: 'my image.png',
        content: toBase64(FIXTURES.png)
      }
    }
    const expected = `data:image/png;base64,${toBase64(FIXTURES.png)}`

    expect(resolveSiblingImageSource('my%20image.png', files)).toBe(expected)
    expect(resolveSiblingImageSource('./my%20image.png', files)).toBe(expected)
    expect(resolveSiblingImageSource('my%20image.png#preview', files)).toBe(null)
    expect(resolveSiblingImageSource('my%20image.png?raw=1', files)).toBe(null)
    expect(resolveSiblingImageSource('../my%20image.png', files)).toBe(null)
    expect(resolveSiblingImageSource('%2Fmy%20image.png', files)).toBe(null)
    expect(resolveSiblingImageSource('file:my%20image.png', files)).toBe(null)
    expect(resolveSiblingImageSource('javascript:alert(1)', files)).toBe(null)
    expect(resolveSiblingImageSource('https://example.com/image.png', files)).toBe(null)
  })

  it('returns safe sibling metadata even when the image content cannot render', () => {
    const corruptFile = {
      filename: 'wrong-name.jpg',
      content: 'not-base64'
    }
    const files = {
      'corrupt.png': corruptFile,
      'image.png': {
        filename: 'wrong-name.jpg',
        content: toBase64(FIXTURES.png)
      }
    }

    expect(resolveSiblingImageReference('corrupt.png', files)).toEqual({
      filename: 'corrupt.png',
      file: corruptFile,
      source: null
    })
    expect(resolveSiblingImageReference('missing.png', files)).toEqual({
      filename: 'missing.png',
      file: null,
      source: null
    })
    expect(resolveSiblingImageReference('image.png', files).source)
      .toBe(`data:image/png;base64,${toBase64(FIXTURES.png)}`)
  })

  it.each([
    '../image.png',
    '%2Fimage.png',
    'file:image.png',
    '//example.com/image.png',
    'https://example.com/image.png'
  ])('does not expose unsafe or external sibling metadata: %s', source => {
    expect(resolveSiblingImageReference(source, {})).toBe(null)
  })
})
