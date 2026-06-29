export function normalizeGistFile (file = {}) {
  return {
    filename: file.filename || '',
    content: file.content || ''
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
  return JSON.stringify(getInitialValues(initialData))
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
