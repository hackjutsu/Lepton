const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize'

function normalizeScopes (scopes = []) {
  if (Array.isArray(scopes)) {
    return scopes.filter(Boolean).join(' ')
  }

  if (typeof scopes === 'string') {
    return scopes
  }

  return ''
}

function buildGitHubOAuthUrl ({ clientId, scopes }) {
  const params = new URLSearchParams()
  params.set('client_id', clientId)

  const scope = normalizeScopes(scopes)
  if (scope) {
    params.set('scope', scope)
  }

  return `${GITHUB_OAUTH_URL}?${params.toString()}`
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

module.exports = {
  buildGitHubOAuthUrl,
  parseGitHubOAuthCallback
}
