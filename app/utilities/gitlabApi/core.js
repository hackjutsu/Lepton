const {
  CREATE_SNIPPET,
  DELETE_SNIPPET,
  GET_SNIPPET,
  GET_USER_PROFILE,
  LIST_SNIPPETS,
  UPDATE_SNIPPET
} = require('../snippetApi/operations')
const { createFetchRequest } = require('../snippetApi/fetchAdapter')
const { createProviderAdapter } = require('../snippetApi/providerAdapter')
const {
  getAccountStorageKey,
  normalizeProviderConfig
} = require('../snippetProvider')

const TAG = '[GitLab REST] '
const REQUEST_TIMEOUT = 20 * 1000
const SNIPPETS_PER_PAGE = 100
const USER_AGENT = 'lepton-snippet-app'

function createGitLabApi ({
  conf,
  fetchImpl,
  gitLabApiBaseUrl,
  logger,
  provider
} = {}) {
  const apiLogger = logger || {
    debug: () => {},
    error: () => {},
    info: () => {}
  }
  const normalizedProvider = resolveGitLabProvider({ conf, gitLabApiBaseUrl, provider })
  const apiBaseUrl = normalizeGitLabApiBaseUrl(firstDefinedValue(
    gitLabApiBaseUrl,
    normalizedProvider.baseUrl
  ))
  const apiRequest = createFetchRequest(fetchImpl, { serviceName: 'GitLab' })

  function getUserProfile (token) {
    apiLogger.debug(TAG + 'Getting user profile ' + JSON.stringify({ hasCredential: Boolean(token) }))
    return apiRequest(makeRequestOptions(token, `${apiBaseUrl}/user`))
      .then(profile => normalizeGitLabProfile(profile, normalizedProvider))
  }

  function getAllSnippets (token, userId) {
    apiLogger.debug(TAG + `Getting personal snippets for ${userId || 'the authenticated user'} ` + JSON.stringify({
      hasCredential: Boolean(token)
    }))

    const snippets = []
    return requestSnippetPage(token, 1, snippets)
      .then(() => snippets
        .map(snippet => normalizeGitLabSnippet(snippet, normalizedProvider, apiBaseUrl))
        .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || ''))))
  }

  function requestSnippetPage (token, page, snippets, requestUrl) {
    const options = makeRequestOptions(token, requestUrl || `${apiBaseUrl}/snippets`, {
      resolveWithFullResponse: true
    })
    if (!requestUrl) {
      options.qs = {
        page,
        per_page: SNIPPETS_PER_PAGE
      }
    }

    return apiRequest(options)
      .then(response => {
        const pageSnippets = Array.isArray(response.body) ? response.body : []
        snippets.push(...pageSnippets.filter(isPersonalSnippet))

        const nextRequest = getNextPageRequest(response, page, pageSnippets.length, apiBaseUrl)
        if (!nextRequest) return snippets

        return requestSnippetPage(token, nextRequest.page, snippets, nextRequest.url)
      })
  }

  function getSingleSnippet (token, snippetId) {
    apiLogger.debug(TAG + `Getting personal snippet ${snippetId} ` + JSON.stringify({
      hasCredential: Boolean(token)
    }))
    return requestSnippet(token, snippetId)
      .then(snippet => hydrateSnippetFiles(token, snippet))
  }

  function createSingleSnippet (token, description, files, isPublic) {
    apiLogger.debug(TAG + 'Creating personal snippet')
    const filePaths = Object.keys(files || {}).filter(filePath => files[filePath] !== null)
    const metadata = toGitLabMetadata(description, filePaths[0])
    const submittedContents = getUpdatedFileContents(files)

    return apiRequest(makeRequestOptions(token, `${apiBaseUrl}/snippets`, {
      body: {
        title: metadata.title,
        description: metadata.description,
        visibility: isPublic ? 'public' : 'private',
        files: filePaths.map(filePath => ({
          file_path: filePath,
          content: getUpdatedFileContent(files[filePath])
        }))
      },
      method: 'POST'
    })).then(snippet => normalizeGitLabSnippet(
      snippet,
      normalizedProvider,
      apiBaseUrl,
      submittedContents
    ))
  }

  function editSingleSnippet (token, snippetId, updatedDescription, updatedFiles) {
    apiLogger.debug(TAG + `Editing personal snippet ${snippetId}`)
    const submittedContents = getUpdatedFileContents(updatedFiles)

    return requestSnippet(token, snippetId)
      .then(existingSnippet => {
        const existingPaths = new Set(getSnippetFileDescriptors(existingSnippet).map(file => file.path))
        const firstFilePath = Object.keys(updatedFiles || {}).find(filePath => updatedFiles[filePath] !== null)
        const metadata = toGitLabMetadata(updatedDescription, firstFilePath, existingSnippet.title)
        const fileActions = buildFileActions(updatedFiles, existingPaths)
        const body = {
          title: metadata.title,
          description: metadata.description
        }
        if (fileActions.length > 0) body.files = fileActions

        return apiRequest(makeRequestOptions(token, `${apiBaseUrl}/snippets/${encodeURIComponent(snippetId)}`, {
          body,
          method: 'PUT'
        }))
      })
      .then(snippet => normalizeGitLabSnippet(
        snippet,
        normalizedProvider,
        apiBaseUrl,
        submittedContents
      ))
  }

  function deleteSingleSnippet (token, snippetId) {
    apiLogger.debug(TAG + `Deleting personal snippet ${snippetId}`)
    return apiRequest(makeRequestOptions(token, `${apiBaseUrl}/snippets/${encodeURIComponent(snippetId)}`, {
      method: 'DELETE'
    }))
  }

  function requestSnippet (token, snippetId) {
    return apiRequest(makeRequestOptions(
      token,
      `${apiBaseUrl}/snippets/${encodeURIComponent(snippetId)}`
    ))
  }

  function hydrateSnippetFiles (token, snippet) {
    const descriptors = getSnippetFileDescriptors(snippet)
    const contentRequests = descriptors.map(file => {
      const rawApiUrl = (file.rawUrl && getRawFileApiUrl(
        file.rawUrl,
        snippet.id,
        file.path,
        apiBaseUrl,
        normalizedProvider.baseUrl
      )) || getLegacyRawApiUrl(snippet, descriptors.length, apiBaseUrl)
      if (!rawApiUrl) return Promise.resolve([file.path, undefined])

      return apiRequest(makeRequestOptions(token, rawApiUrl, {
        json: false
      })).then(content => [file.path, content])
    })

    return Promise.all(contentRequests)
      .then(entries => {
        const contentsByPath = Object.create(null)
        entries.forEach(([filePath, content]) => {
          if (content !== undefined) contentsByPath[filePath] = content
        })
        return normalizeGitLabSnippet(snippet, normalizedProvider, apiBaseUrl, contentsByPath)
      })
  }

  function makeRequestOptions (token, uri, overrides = {}) {
    const options = Object.assign({
      uri,
      headers: {
        'User-Agent': USER_AGENT,
        'PRIVATE-TOKEN': token
      },
      method: 'GET',
      json: true,
      timeout: REQUEST_TIMEOUT
    }, overrides)

    // PRIVATE-TOKEN is not a Fetch-managed credential header, so Fetch may
    // retain it across origins. Reject redirects rather than risk forwarding it.
    options.redirect = 'error'
    return options
  }

  return createProviderAdapter('gitlab', {
    [LIST_SNIPPETS]: getAllSnippets,
    [GET_SNIPPET]: getSingleSnippet,
    [GET_USER_PROFILE]: getUserProfile,
    [CREATE_SNIPPET]: createSingleSnippet,
    [UPDATE_SNIPPET]: editSingleSnippet,
    [DELETE_SNIPPET]: deleteSingleSnippet
  })
}

function isPersonalSnippet (snippet) {
  return snippet && (snippet.project_id === null || snippet.project_id === undefined)
}

function normalizeGitLabProfile (profile, provider) {
  const normalizedProvider = normalizeProviderConfig(provider)
  const login = profile && (profile.username || profile.login)
  const htmlUrl = profile && (profile.web_url || profile.html_url)

  return Object.assign({}, profile, {
    login,
    html_url: htmlUrl || buildAccountUrl(normalizedProvider.baseUrl, login),
    provider: normalizedProvider.type,
    providerType: normalizedProvider.type,
    providerBaseUrl: normalizedProvider.baseUrl,
    starred_url: null,
    storageKey: getAccountStorageKey(normalizedProvider, login)
  })
}

function normalizeGitLabSnippet (snippet, provider, apiBaseUrl, contentsByPath = {}) {
  const normalizedProvider = normalizeProviderConfig(provider)
  const author = normalizeGitLabAuthor(snippet && snippet.author)
  const snippetId = String(snippet && snippet.id)
  const htmlUrl = snippet && (snippet.web_url || snippet.html_url)
  const storageKey = getAccountStorageKey(normalizedProvider, author && author.login)
  const fileDescriptors = getSnippetFileDescriptors(snippet)
  const files = Object.create(null)

  fileDescriptors.forEach(file => {
    const hasContent = Object.prototype.hasOwnProperty.call(contentsByPath, file.path)
    const content = hasContent ? contentsByPath[file.path] : undefined
    files[file.path] = removeUndefinedProperties({
      filename: file.path,
      type: getMimeType(file.path),
      language: getLanguage(file.path),
      raw_url: file.rawUrl || (fileDescriptors.length === 1 ? snippet.raw_url : null),
      html_url: file.htmlUrl || htmlUrl || null,
      size: hasContent ? Buffer.byteLength(content, 'utf8') : undefined,
      truncated: false,
      content,
      provider: normalizedProvider.type,
      providerType: normalizedProvider.type,
      providerBaseUrl: normalizedProvider.baseUrl,
      storageKey
    })
  })

  return Object.assign({}, snippet, {
    id: snippetId,
    url: `${apiBaseUrl}/snippets/${encodeURIComponent(snippetId)}`,
    description: toGitHubDescription(snippet),
    public: snippet && snippet.visibility === 'public',
    html_url: htmlUrl,
    history_url: null,
    owner: author,
    files,
    providerTitle: String((snippet && snippet.title) || ''),
    providerDescription: String((snippet && snippet.description) || ''),
    provider: normalizedProvider.type,
    providerType: normalizedProvider.type,
    providerBaseUrl: normalizedProvider.baseUrl,
    storageKey
  })
}

function normalizeGitLabAuthor (author) {
  if (!author) return null
  return Object.assign({}, author, {
    login: author.username || author.login,
    html_url: author.web_url || author.html_url
  })
}

function getSnippetFileDescriptors (snippet) {
  const snippetFiles = snippet && Array.isArray(snippet.files) ? snippet.files : []
  const descriptors = snippetFiles
    .map(file => ({
      path: file && (file.path || file.file_path || file.filename),
      rawUrl: file && (file.raw_url || file.rawUrl),
      htmlUrl: file && (file.web_url || file.html_url)
    }))
    .filter(file => file.path)

  if (descriptors.length > 0) return descriptors
  if (!snippet || !snippet.file_name) return []

  return [{
    path: snippet.file_name,
    rawUrl: snippet.raw_url,
    htmlUrl: snippet.web_url || snippet.html_url
  }]
}

function getNextPageRequest (response, currentPage, pageLength, apiBaseUrl) {
  const headers = response.headers || {}
  const nextPage = parsePositiveInteger(headers['x-next-page'])
  if (nextPage && nextPage > currentPage) return { page: nextPage }

  const nextUrl = getNextLink(headers.link, apiBaseUrl)
  if (nextUrl) return { page: currentPage + 1, url: nextUrl }

  if (pageLength === SNIPPETS_PER_PAGE) {
    return { page: currentPage + 1 }
  }

  return null
}

function getNextLink (linkHeader, apiBaseUrl) {
  if (!linkHeader) return null
  const link = String(linkHeader)
    .split(',')
    .map(value => value.trim())
    .find(value => /;\s*rel="?next"?/i.test(value))
  const match = link && link.match(/^<([^>]+)>/)
  if (!match) return null

  try {
    const apiUrl = new URL(apiBaseUrl)
    const nextUrl = new URL(match[1], `${apiBaseUrl}/`)
    const snippetsPath = `${apiUrl.pathname.replace(/\/$/, '')}/snippets`
    if (nextUrl.origin !== apiUrl.origin || nextUrl.pathname !== snippetsPath) return null
    return nextUrl.toString()
  } catch (error) {
    return null
  }
}

function parsePositiveInteger (value) {
  const parsedValue = Number.parseInt(value, 10)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
}

function buildFileActions (updatedFiles, existingPaths) {
  return Object.keys(updatedFiles || {}).reduce((actions, filePath) => {
    const file = updatedFiles[filePath]
    if (file === null) {
      if (existingPaths.has(filePath)) {
        actions.push({
          action: 'delete',
          file_path: filePath
        })
      }
      return actions
    }

    actions.push({
      action: existingPaths.has(filePath) ? 'update' : 'create',
      file_path: filePath,
      content: getUpdatedFileContent(file)
    })
    return actions
  }, [])
}

function getUpdatedFileContent (file) {
  return file && typeof file.content === 'string' ? file.content : ''
}

function getUpdatedFileContents (files) {
  return Object.keys(files || {}).reduce((contents, filePath) => {
    if (files[filePath] !== null) {
      contents[filePath] = getUpdatedFileContent(files[filePath])
    }
    return contents
  }, Object.create(null))
}

function toGitHubDescription (snippet) {
  const title = String((snippet && snippet.title) || '').trim()
  const description = String((snippet && snippet.description) || '').trim()
  if (!title) return description
  return `[${title}]${description ? ' ' + description : ''}`
}

function toGitLabMetadata (description, fallbackTitle, existingTitle) {
  const rawDescription = String(description || '').trim()
  const existingTitlePrefix = existingTitle ? `[${existingTitle}]` : ''
  if (existingTitlePrefix && rawDescription.startsWith(existingTitlePrefix)) {
    return {
      title: normalizeGitLabTitle(existingTitle, fallbackTitle),
      description: rawDescription.slice(existingTitlePrefix.length).trim()
    }
  }

  const parsedDescription = parseLeadingTitleMetadata(rawDescription)
  if (parsedDescription) {
    return {
      title: normalizeGitLabTitle(parsedDescription.title, fallbackTitle),
      description: parsedDescription.description
    }
  }

  return {
    title: normalizeGitLabTitle(fallbackTitle),
    description: rawDescription
  }
}

function parseLeadingTitleMetadata (description) {
  const value = String(description || '').trim()
  if (value[0] !== '[') return null

  let depth = 0
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '[') depth += 1
    if (value[index] !== ']') continue

    depth -= 1
    if (depth === 0) {
      return {
        title: value.slice(1, index),
        description: value.slice(index + 1).trim()
      }
    }
    if (depth < 0) return null
  }

  return null
}

function normalizeGitLabTitle (title, fallbackTitle) {
  return String(title || fallbackTitle || 'Untitled snippet').trim().slice(0, 255) || 'Untitled snippet'
}

function resolveGitLabProvider ({ conf, gitLabApiBaseUrl, provider }) {
  if (provider) {
    const normalizedProvider = normalizeProviderConfig(provider)
    if (normalizedProvider.type !== 'gitlab') {
      throw new Error(`Expected GitLab provider, received ${normalizedProvider.type}`)
    }
    return normalizedProvider
  }

  const gitLabConfig = getConfValue(conf, 'gitlab')
  if (gitLabConfig !== undefined && !isPlainConfigObject(gitLabConfig)) {
    throw new Error('Invalid GitLab configuration')
  }

  const configuredBaseUrl = firstDefinedValue(
    gitLabApiBaseUrl,
    getConfValue(conf, 'gitlab:host')
  )
  return normalizeProviderConfig({
    type: 'gitlab',
    baseUrl: configuredBaseUrl
  })
}

function normalizeGitLabApiBaseUrl (baseUrl) {
  const normalizedProvider = normalizeProviderConfig({ type: 'gitlab', baseUrl })
  return `${normalizedProvider.baseUrl}/api/v4`
}

function getConfValue (conf, key) {
  return conf && typeof conf.get === 'function' ? conf.get(key) : undefined
}

function isPlainConfigObject (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function firstDefinedValue (...values) {
  return values.find(value => value !== undefined)
}

function buildAccountUrl (baseUrl, login) {
  return login ? `${baseUrl}/${encodeURIComponent(login)}` : baseUrl
}

function getRawFileApiUrl (rawUrl, snippetId, filePath, apiBaseUrl, providerBaseUrl) {
  let rawPath
  try {
    rawPath = new URL(rawUrl, `${providerBaseUrl}/`).pathname
  } catch (error) {
    return null
  }

  const rawPathMatch = rawPath.match(/\/(?:-\/)?snippets\/[^/]+\/raw\/([^/]+)\/.+$/)
  if (!rawPathMatch) return null

  let ref
  try {
    ref = decodeURIComponent(rawPathMatch[1])
  } catch (error) {
    return null
  }

  return `${apiBaseUrl}/snippets/${encodeURIComponent(snippetId)}/files/${encodeURIComponent(ref)}/${encodeURIComponent(filePath)}/raw`
}

function getLegacyRawApiUrl (snippet, fileCount, apiBaseUrl) {
  if (!snippet || fileCount !== 1 || !snippet.raw_url) return null
  return `${apiBaseUrl}/snippets/${encodeURIComponent(snippet.id)}/raw`
}

function getLanguage (filePath) {
  const extension = getFileExtension(filePath)
  return LANGUAGE_BY_EXTENSION[extension] || null
}

function getMimeType (filePath) {
  const extension = getFileExtension(filePath)
  return MIME_TYPE_BY_EXTENSION[extension] || 'text/plain'
}

function getFileExtension (filePath) {
  const match = String(filePath || '').toLowerCase().match(/\.([^./]+)$/)
  return match ? match[1] : ''
}

function removeUndefinedProperties (value) {
  Object.keys(value).forEach(key => {
    if (value[key] === undefined) delete value[key]
  })
  return value
}

const LANGUAGE_BY_EXTENSION = {
  c: 'C',
  cc: 'C++',
  cpp: 'C++',
  cs: 'C#',
  css: 'CSS',
  go: 'Go',
  h: 'C',
  hpp: 'C++',
  html: 'HTML',
  java: 'Java',
  js: 'JavaScript',
  json: 'JSON',
  jsx: 'JavaScript',
  md: 'Markdown',
  php: 'PHP',
  py: 'Python',
  rb: 'Ruby',
  rs: 'Rust',
  scss: 'SCSS',
  sh: 'Shell',
  sql: 'SQL',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML'
}

const MIME_TYPE_BY_EXTENSION = {
  css: 'text/css',
  html: 'text/html',
  js: 'text/javascript',
  json: 'application/json',
  md: 'text/markdown',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml'
}

module.exports = {
  createGitLabApi,
  normalizeGitLabProfile,
  normalizeGitLabSnippet,
  toGitLabMetadata
}
