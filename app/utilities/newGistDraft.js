const NEW_GIST_DRAFT_STORAGE_PREFIX = 'new-gist-draft'

function createStorageFailure (error) {
  return {
    status: false,
    error
  }
}

export function getNewGistDraftStorageKey (userLogin) {
  const owner = typeof userLogin === 'string' && userLogin.trim()
    ? encodeURIComponent(userLogin.trim())
    : 'anonymous'

  return `${NEW_GIST_DRAFT_STORAGE_PREFIX}-${owner}`
}

export function createNewGistDraft (data = {}) {
  const sourceFiles = Array.isArray(data.gistFiles)
    ? data.gistFiles
    : data.gists
  const gists = Array.isArray(sourceFiles)
    ? sourceFiles.map(file => ({
      filename: file && typeof file.filename === 'string' ? file.filename : '',
      content: file && typeof file.content === 'string' ? file.content : ''
    }))
    : []

  return {
    description: typeof data.description === 'string' ? data.description : '',
    private: Boolean(data.private),
    gists: gists.length ? gists : [{ filename: '', content: '' }]
  }
}

function isNewGistDraft (draft) {
  return Boolean(
    draft &&
    typeof draft === 'object' &&
    typeof draft.description === 'string' &&
    typeof draft.private === 'boolean' &&
    Array.isArray(draft.gists) &&
    draft.gists.length &&
    draft.gists.every(file =>
      file &&
      typeof file.filename === 'string' &&
      typeof file.content === 'string'
    )
  )
}

export function loadNewGistDraft (storage, userLogin) {
  try {
    const result = storage.get(getNewGistDraftStorageKey(userLogin))
    if (!result || !result.status || !isNewGistDraft(result.data)) return null
    return createNewGistDraft(result.data)
  } catch {
    return null
  }
}

export function saveNewGistDraft (storage, userLogin, data) {
  try {
    return storage.set(
      getNewGistDraftStorageKey(userLogin),
      createNewGistDraft(data)
    )
  } catch (error) {
    return createStorageFailure(error)
  }
}

export function createNewGistWithDraft ({ storage, userLogin, data, createGist }) {
  const draftWrite = saveNewGistDraft(storage, userLogin, data)

  return Promise.resolve()
    .then(createGist)
    .then(gistDetails => ({
      status: 'created',
      gistDetails,
      draftWrite
    }), error => ({
      status: 'failed',
      error,
      draftWrite
    }))
}

export function clearNewGistDraft (storage, userLogin) {
  try {
    return storage.set(getNewGistDraftStorageKey(userLogin), null)
  } catch (error) {
    return createStorageFailure(error)
  }
}
