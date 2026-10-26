const DEFAULT_IMAGE_FILENAME = 'image.png'

const IMAGE_TYPES = [
  {
    extensions: ['png'],
    mimeType: 'image/png',
    matches: bytes => matchesBytes(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  },
  {
    extensions: ['jpg', 'jpeg'],
    mimeType: 'image/jpeg',
    matches: bytes => matchesBytes(bytes, [0xFF, 0xD8, 0xFF])
  },
  {
    extensions: ['gif'],
    mimeType: 'image/gif',
    matches: bytes => matchesAscii(bytes, 0, 'GIF87a') || matchesAscii(bytes, 0, 'GIF89a')
  },
  {
    extensions: ['webp'],
    mimeType: 'image/webp',
    matches: bytes => matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WEBP')
  }
]

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

class ImageAttachmentError extends Error {
  constructor (code, details = {}) {
    super(code)
    this.name = 'ImageAttachmentError'
    this.code = code
    this.details = details
  }
}

function matchesBytes (bytes, expected, offset = 0) {
  if (!bytes || bytes.length < offset + expected.length) return false
  return expected.every((value, index) => bytes[offset + index] === value)
}

function matchesAscii (bytes, offset, expected) {
  if (!bytes || bytes.length < offset + expected.length) return false
  for (let index = 0; index < expected.length; index++) {
    if (bytes[offset + index] !== expected.charCodeAt(index)) return false
  }
  return true
}

function getFilenameExtension (filename) {
  if (typeof filename !== 'string') return ''
  const match = filename.trim().match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ''
}

function getImageTypeForFilename (filename) {
  const extension = getFilenameExtension(filename)
  return IMAGE_TYPES.find(imageType => imageType.extensions.includes(extension)) || null
}

function getImageTypeForMimeType (mimeType) {
  if (typeof mimeType !== 'string') return null
  return IMAGE_TYPES.find(imageType => imageType.mimeType === mimeType.toLowerCase()) || null
}

function isSupportedImageFilename (filename) {
  return Boolean(getImageTypeForFilename(filename))
}

function normalizeBase64Content (content) {
  if (typeof content !== 'string') return null
  const normalized = content.trim()
  if (!normalized || normalized.startsWith('data:')) return null
  if (normalized.length % 4 !== 0 || !BASE64_PATTERN.test(normalized)) return null
  return normalized
}

function decodeBase64Prefix (content, maxBytes = 16) {
  const normalized = normalizeBase64Content(content)
  if (!normalized) return null

  try {
    const prefixLength = Math.min(normalized.length, Math.ceil(maxBytes / 3) * 4)
    const binary = globalThis.atob(normalized.slice(0, prefixLength))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

function getDecodedSize (base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return (base64.length * 3 / 4) - padding
}

function inspectImageFile (file = {}) {
  const filename = typeof file.filename === 'string' ? file.filename : ''
  const imageType = getImageTypeForFilename(filename)
  if (!imageType) {
    return { valid: false, kind: 'invalid', filename, reason: 'unsupported-type' }
  }

  const isGitHubBinary = file.encoding === 'base64'
  const rawSource = typeof file.raw_url === 'string' && /^https?:\/\//i.test(file.raw_url)
    ? file.raw_url
    : null
  const normalizedBase64 = normalizeBase64Content(file.content)
  const prefix = normalizedBase64 ? decodeBase64Prefix(normalizedBase64) : null
  const matchesImageType = Boolean(prefix && imageType.matches(prefix))

  if (isGitHubBinary && rawSource && (file.truncated || !normalizedBase64 || !matchesImageType)) {
    return {
      valid: true,
      kind: 'github-binary',
      filename,
      mediaType: imageType.mimeType,
      normalizedBase64: null,
      decodedSize: Number.isFinite(file.size) ? file.size : null,
      dataUrl: null,
      source: rawSource
    }
  }

  if (!normalizedBase64 || !matchesImageType) {
    return { valid: false, kind: 'invalid', filename, reason: 'invalid-content' }
  }

  const dataUrl = `data:${imageType.mimeType};base64,${normalizedBase64}`
  return {
    valid: true,
    kind: isGitHubBinary ? 'github-binary' : 'base64-text',
    filename,
    mediaType: imageType.mimeType,
    normalizedBase64,
    decodedSize: getDecodedSize(normalizedBase64),
    dataUrl,
    source: dataUrl
  }
}

function isBase64TextImage (file) {
  const inspected = inspectImageFile(file)
  return inspected.valid && inspected.kind === 'base64-text'
}

function isNativeBinaryFile (file = {}) {
  return file.encoding === 'base64'
}

function isNativeBinaryImage (file = {}) {
  return isSupportedImageFilename(file.filename) && isNativeBinaryFile(file)
}

function isImageAttachmentFile (file) {
  return isNativeBinaryImage(file) || isBase64TextImage(file)
}

function getRenderableImageSource (file) {
  const inspected = inspectImageFile(file)
  return inspected.valid ? inspected.source : null
}

function bytesToBase64 (value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  const chunkSize = 0x8000
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize))
  }

  return globalThis.btoa(binary)
}

function getInputFilename (file) {
  const filename = file && typeof file.name === 'string' ? file.name.trim() : ''
  if (filename) return filename

  const imageType = getImageTypeForMimeType(file && file.type)
  if (!imageType) return DEFAULT_IMAGE_FILENAME
  return `image.${imageType.extensions[0]}`
}

async function createBase64ImageAttachment (file, maxSizeKB) {
  const filename = getInputFilename(file)
  const imageType = getImageTypeForFilename(filename)
  if (!imageType || !file || typeof file.arrayBuffer !== 'function') {
    throw new ImageAttachmentError('unsupported-type', { filename })
  }

  const maxBytes = maxSizeKB * 1024
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new ImageAttachmentError('unsupported-type', { filename })
  }
  if (file.size > maxBytes) {
    throw new ImageAttachmentError('too-large', {
      filename,
      maxSizeKB,
      sizeKB: Math.ceil(file.size / 1024)
    })
  }

  let bytes
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    throw new ImageAttachmentError('read-failed', { filename })
  }

  if (bytes.length > maxBytes) {
    throw new ImageAttachmentError('too-large', {
      filename,
      maxSizeKB,
      sizeKB: Math.ceil(bytes.length / 1024)
    })
  }
  if (!imageType.matches(bytes)) {
    throw new ImageAttachmentError('unsupported-type', { filename })
  }

  return {
    filename,
    content: bytesToBase64(bytes),
    _imageAttachment: true
  }
}

function createUniqueFilename (filename, existingFilenames) {
  const existing = new Set((existingFilenames || []).map(value => String(value).toLowerCase()))
  if (!existing.has(filename.toLowerCase())) return filename

  const extensionMatch = filename.match(/(\.[^.]+)$/)
  const suffix = extensionMatch ? extensionMatch[1] : ''
  const stem = suffix ? filename.slice(0, -suffix.length) : filename
  let counter = 2
  let candidate = `${stem}-${counter}${suffix}`
  while (existing.has(candidate.toLowerCase())) {
    counter += 1
    candidate = `${stem}-${counter}${suffix}`
  }
  return candidate
}

function createMarkdownImageReference (filename) {
  const label = filename
    .replace(/\.[^.]+$/, '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/]/g, '\\]')
  // encodeURIComponent leaves parentheses intact, but Markdown uses them to
  // delimit the destination. Escape them even when the filename is unbalanced.
  const destination = encodeURIComponent(filename)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
  return `![${label}](${destination})`
}

function getFilesFromTransfer (transfer, imagesOnly = true) {
  if (!transfer) return []
  const files = Array.from(transfer.files || [])
  if (files.length) {
    return files.filter(file => {
      return !imagesOnly || isSupportedImageFilename(file.name) || (typeof file.type === 'string' && file.type.startsWith('image/'))
    })
  }

  return Array.from(transfer.items || [])
    .filter(item => item.kind === 'file' && typeof item.getAsFile === 'function')
    .map(item => item.getAsFile())
    .filter(file => file && (
      !imagesOnly || isSupportedImageFilename(file.name) || (typeof file.type === 'string' && file.type.startsWith('image/'))
    ))
}

function getSiblingFile (files, filename) {
  if (Array.isArray(files)) {
    return files.find(file => file && file.filename === filename) || null
  }
  if (!files || !Object.prototype.hasOwnProperty.call(files, filename)) return null
  return files[filename]
}

function containsControlCharacters (value) {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0)
    return code <= 0x1F || code === 0x7F
  })
}

function getSafeSiblingFilename (source) {
  if (typeof source !== 'string' || !source) return null
  const trimmed = source.trim()
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('\\')) return null
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed) || trimmed.startsWith('//')) return null
  if (/[?#]/.test(trimmed)) return null

  const relativePath = trimmed.startsWith('./') ? trimmed.slice(2) : trimmed
  let filename
  try {
    filename = decodeURIComponent(relativePath)
  } catch {
    return null
  }

  if (
    !filename ||
    filename === '..' ||
    /[\\/]/.test(filename) ||
    containsControlCharacters(filename)
  ) {
    return null
  }

  return filename
}

function resolveSiblingImageReference (source, files) {
  const filename = getSafeSiblingFilename(source)
  if (!filename) return null

  const file = getSiblingFile(files, filename)
  return {
    filename,
    file,
    source: file
      ? getRenderableImageSource(Object.assign({}, file, { filename }))
      : null
  }
}

function resolveSiblingImageSource (source, files) {
  const reference = resolveSiblingImageReference(source, files)
  return reference ? reference.source : null
}

module.exports = {
  IMAGE_TYPES,
  ImageAttachmentError,
  createBase64ImageAttachment,
  createUniqueFilename,
  createMarkdownImageReference,
  getDecodedSize,
  getFilesFromTransfer,
  getImageTypeForFilename,
  getRenderableImageSource,
  inspectImageFile,
  isBase64TextImage,
  isImageAttachmentFile,
  isNativeBinaryFile,
  isNativeBinaryImage,
  isSupportedImageFilename,
  normalizeBase64Content,
  resolveSiblingImageReference,
  resolveSiblingImageSource
}
