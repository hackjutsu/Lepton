let nextGistFileEditorId = 0

export function createGistFileEditorId () {
  return `gist-file-editor-${nextGistFileEditorId++}`
}

export function normalizeGistFile (file = {}) {
  return {
    filename: file.filename || '',
    content: file.content || '',
    _editorId: file._editorId || createGistFileEditorId()
  }
}

export function normalizeSubmitGistFile (file = {}) {
  return {
    filename: file.filename || '',
    content: file.content || ''
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
