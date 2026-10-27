const {
  createBase64ImageAttachment,
  ImageAttachmentError,
  isSupportedImageFilename
} = require('../imageAttachments')

const MAX_TEXT_FILE_SIZE_KB = 700

async function createFileAttachment (file, imageMaxSizeKB) {
  const filename = file && typeof file.name === 'string' ? file.name.trim() : ''
  if (isSupportedImageFilename(filename) || (file && /^image\//i.test(file.type))) {
    return createBase64ImageAttachment(file, imageMaxSizeKB)
  }
  if (!filename || !file || typeof file.arrayBuffer !== 'function') {
    throw new ImageAttachmentError('unsupported-file', { filename })
  }
  const maxBytes = MAX_TEXT_FILE_SIZE_KB * 1024
  const checkSize = size => {
    if (size > maxBytes) {
      throw new ImageAttachmentError('too-large', {
        filename,
        maxSizeKB: MAX_TEXT_FILE_SIZE_KB,
        sizeKB: Math.ceil(size / 1024)
      })
    }
  }
  checkSize(file.size)
  let bytes
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    throw new ImageAttachmentError('read-failed', { filename })
  }
  checkSize(bytes.length)
  let content
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new ImageAttachmentError('unsupported-file', { filename })
  }
  // Reject binary controls while preserving tabs, line endings, and Unicode.
  if (Array.from(content).some(character => {
    const code = character.charCodeAt(0)
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127
  })) {
    throw new ImageAttachmentError('unsupported-file', { filename })
  }
  return { filename, content }
}

module.exports = { createFileAttachment, MAX_TEXT_FILE_SIZE_KB }
