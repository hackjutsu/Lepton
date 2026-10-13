let nextGistFileEditorId = 0

const {
  createUniqueFilename,
  isBase64TextImage,
  isNativeBinaryFile
} = require('../../utilities/imageAttachments')

const GIST_FILE_METADATA_KEYS = [
  'encoding',
  'raw_url',
  'size',
  'truncated',
  'type'
]

export function createGistFileEditorId () {
  return `gist-file-editor-${nextGistFileEditorId++}`
}

export function normalizeGistFile (file = {}) {
  const normalized = {
    filename: file.filename || '',
    content: file.content || '',
    _editorId: file._editorId || createGistFileEditorId()
  }

  GIST_FILE_METADATA_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(file, key)) normalized[key] = file[key]
  })

  if (file._imageAttachment || isBase64TextImage(file)) normalized._imageAttachment = true
  if (file._nativeBinary || isNativeBinaryFile(file)) {
    normalized._nativeBinary = true
    normalized._originalFilename = file._originalFilename || file.filename || ''
  }
  return normalized
}

export function normalizeSubmitGistFile (file = {}) {
  const normalized = {
    filename: file.filename || '',
    content: file.content || ''
  }

  if (file._nativeBinary || isNativeBinaryFile(file)) {
    normalized._nativeBinary = true
    normalized._originalFilename = file._originalFilename || file.filename || ''
  }
  return normalized
}

export function appendImageAttachments (gistFiles, attachments) {
  const normalizedFiles = gistFiles.map(normalizeGistFile)
  const existingFilenames = normalizedFiles.map(file => file.filename)
  const addedFilenames = []
  const addedFiles = attachments.map(attachment => {
    const filename = createUniqueFilename(attachment.filename, existingFilenames)
    existingFilenames.push(filename)
    addedFilenames.push(filename)
    return normalizeGistFile(Object.assign({}, attachment, { filename }))
  })

  const isSingleEmptyFile = normalizedFiles.length === 1 &&
    !normalizedFiles[0].filename && !normalizedFiles[0].content
  const nextFiles = isSingleEmptyFile
    ? addedFiles
    : normalizedFiles.concat(addedFiles)

  return {
    gistFiles: nextFiles.length ? nextFiles : normalizedFiles,
    filenames: addedFilenames
  }
}

export function getGistFileEditorKey (file, fallbackKey) {
  return file && file._editorId ? file._editorId : fallbackKey
}

export function getSubmitValues (values) {
  return {
    description: values.description,
    private: values.private,
    gistFiles: values.gistFiles.map(normalizeSubmitGistFile)
  }
}

function getInitialSubmitValues (initialData = {}) {
  const gistFiles = Array.isArray(initialData.gists)
    ? initialData.gists.map(normalizeSubmitGistFile)
    : []

  return {
    description: initialData.description || '',
    private: Boolean(initialData.private),
    gistFiles: gistFiles.length ? gistFiles : [normalizeSubmitGistFile()]
  }
}

export function getInitialValues (initialData = {}) {
  const gistFiles = Array.isArray(initialData.gists)
    ? initialData.gists.map(normalizeGistFile)
    : []

  return {
    description: initialData.description || '',
    private: Boolean(initialData.private),
    gistFiles: gistFiles.length ? gistFiles : [normalizeGistFile()]
  }
}

export function getInitialValuesKey (initialData) {
  return JSON.stringify(getInitialSubmitValues(initialData))
}

export function copyValues (values) {
  return {
    description: values.description,
    private: values.private,
    gistFiles: values.gistFiles.map(normalizeGistFile)
  }
}

export function createFormState (initialData) {
  return {
    values: getInitialValues(initialData),
    errors: {},
    imageError: '',
    imageProcessing: false,
    touched: {},
    submitAttempted: false,
    submitting: false,
    initialValuesKey: getInitialValuesKey(initialData)
  }
}

export function touchAllFields (values) {
  return values.gistFiles.reduce((touched, file, index) => Object.assign(touched, {
    [`gistFiles.${index}.filename`]: true,
    [`gistFiles.${index}.content`]: true
  }), {
    description: true
  })
}

export function hasValidationErrors (errors) {
  return Boolean(
    errors.description ||
    (errors.gistFiles && errors.gistFiles.some(fileErrors =>
      fileErrors.filename || fileErrors.content
    ))
  )
}

export function shouldShowError (touched, submitAttempted, fieldName) {
  return Boolean(submitAttempted || touched[fieldName])
}
