const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize'
const ELECTRON_ABORTED_LOAD_ERROR_CODE = -3

function normalizeScopes (scopes = []) {
  if (Array.isArray(scopes)) {
    return scopes.filter(Boolean).join(' ')
  }

  if (typeof scopes === 'string') {
    return scopes
  }

  return ''
}

function buildGitHubOAuthUrl ({ authorizeUrl = GITHUB_OAUTH_URL, clientId, scopes }) {
  const params = new URLSearchParams()
  params.set('client_id', clientId)

  const scope = normalizeScopes(scopes)
  if (scope) {
    params.set('scope', scope)
  }

  return `${authorizeUrl}?${params.toString()}`
}

function parseGitHubOAuthCallback (callbackUrl) {
  if (typeof callbackUrl !== 'string') {
    return null
  }

  let parsedUrl
  try {
    parsedUrl = new URL(callbackUrl)
  } catch (err) {
    return null
  }

  const code = parsedUrl.searchParams.get('code')
  if (code) {
    return {
      status: 'success',
      code
    }
  }

  const error = parsedUrl.searchParams.get('error')
  if (error) {
    return {
      status: 'error',
      error,
      errorDescription: parsedUrl.searchParams.get('error_description')
    }
  }

  return null
}

function describeGitHubOAuthUrl (callbackUrl) {
  if (typeof callbackUrl !== 'string') {
    return {
      valid: false,
      reason: 'not-string'
    }
  }

  let parsedUrl
  try {
    parsedUrl = new URL(callbackUrl)
  } catch (err) {
    return {
      valid: false,
      reason: 'invalid-url'
    }
  }

  const code = parsedUrl.searchParams.get('code')
  const error = parsedUrl.searchParams.get('error')

  return removeUndefinedProperties({
    valid: true,
    origin: parsedUrl.origin,
    pathname: parsedUrl.pathname,
    queryKeys: Array.from(parsedUrl.searchParams.keys()).sort(),
    hasCode: Boolean(code),
    codeLength: code ? code.length : undefined,
    hasError: Boolean(error),
    error: error || undefined,
    errorDescription: parsedUrl.searchParams.get('error_description') || undefined
  })
}

function shouldIgnoreGitHubOAuthLoadFailure ({
  errorCode,
  errorDescription,
  isMainFrame
} = {}) {
  return isAbortedLoadError(errorCode, errorDescription) || isMainFrame === false
}

function isAbortedLoadError (errorCode, errorDescription) {
  return Number(errorCode) === ELECTRON_ABORTED_LOAD_ERROR_CODE ||
    /\bERR_ABORTED\b|\(-3\)/.test(String(errorDescription || ''))
}

function removeUndefinedProperties (value) {
  Object.keys(value).forEach(key => {
    if (value[key] === undefined) {
      delete value[key]
    }
  })
  return value
}

module.exports = {
  buildGitHubOAuthUrl,
  describeGitHubOAuthUrl,
  parseGitHubOAuthCallback,
  shouldIgnoreGitHubOAuthLoadFailure
}
