import { describe, expect, it, vi } from 'vitest'
import githubApiCore from '../../app/utilities/githubApi/core'
import githubFetchAdapter from '../../app/utilities/githubApi/fetchAdapter'
import snippetOperations from '../../app/utilities/snippetApi/operations'

const {
  createGitHubApi
} = githubApiCore
const {
  CREATE_SNIPPET,
  DELETE_SNIPPET,
  EXCHANGE_ACCESS_TOKEN,
  GET_SNIPPET,
  GET_USER_PROFILE,
  LIST_SNIPPETS
} = snippetOperations

const logger = {
  debug: () => {},
  error: () => {},
  info: () => {}
}

function createConf (values = {}) {
  return {
    get: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : false
  }
}

function createHeaders (values = {}) {
  const normalizedValues = {}
  Object.keys(values).forEach(key => {
    normalizedValues[key.toLowerCase()] = values[key]
  })

  return {
    forEach: (callback) => {
      Object.keys(normalizedValues).forEach(key => callback(normalizedValues[key], key))
    },
    get: (key) => normalizedValues[key.toLowerCase()] || null
  }
}

function createJsonResponse (body, {
  status = 200,
  statusText = 'OK',
  headers = {}
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: createHeaders(headers),
    text: () => Promise.resolve(body === null || body === undefined ? '' : JSON.stringify(body))
  }
}

function createTextResponse (body, {
  status = 200,
  statusText = 'OK',
  headers = {}
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: createHeaders(headers),
    text: () => Promise.resolve(body)
  }
}

function loadGitHubApi ({
  confValues = {},
  fetchImpl
} = {}) {
  const fetch = vi.fn(fetchImpl || (() => Promise.resolve(createJsonResponse({}))))

  const api = createGitHubApi({
    conf: createConf(confValues),
    logger,
    fetchImpl: fetch
  })

  return {
    api,
    fetch
  }
}

describe('GitHub API utility', () => {
  it('keeps GitHub error labels on the legacy fetch-adapter import', async () => {
    const request = githubFetchAdapter.createFetchRequest(() => Promise.resolve(createJsonResponse({
      message: 'Bad credentials'
    }, {
      status: 401,
      statusText: 'Unauthorized'
    })))

    await expect(request({
      uri: 'https://api.github.com/user',
      json: true
    })).rejects.toMatchObject({
      message: 'GitHub API request failed with status 401 Unauthorized'
    })
  })

  it('builds the OAuth access-token exchange request', async () => {
    const { api, fetch } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createJsonResponse({ access_token: 'token-1' }))
    })

    await api.getRequest(EXCHANGE_ACCESS_TOKEN)('client-id', 'client-secret', 'auth-code')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://github.com/login/oauth/access_token')
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      body: 'client_id=client-id&client_secret=client-secret&code=auth-code'
    }))
    expect(init.headers).toEqual(expect.objectContaining({
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'lepton-snippet-app'
    }))
    expect(init).not.toHaveProperty('agent')
  })

  it('supports a mock OAuth token endpoint for login-flow smoke tests', async () => {
    const fetch = vi.fn(() => Promise.resolve(createJsonResponse({ access_token: 'token-1' })))

    const mockApi = createGitHubApi({
      conf: createConf(),
      logger,
      oauthAccessTokenUrl: 'http://127.0.0.1:9999/login/oauth/access_token',
      fetchImpl: fetch
    })

    await mockApi.getRequest(EXCHANGE_ACCESS_TOKEN)('client-id', 'client-secret', 'auth-code')

    const [url] = fetch.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:9999/login/oauth/access_token')
  })

  it('supports a mock GitHub API base URL for login-flow smoke tests', async () => {
    const fetch = vi.fn((url) => Promise.resolve(createJsonResponse(
      String(url).includes('/user') ? { login: 'octo' } : []
    )))
    const api = createGitHubApi({
      conf: createConf(),
      gitHubApiBaseUrl: 'http://127.0.0.1:9999/api/',
      logger,
      fetchImpl: fetch
    })

    await api.getRequest(GET_USER_PROFILE)('token-1')
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:9999/api/user')

    fetch.mockClear()
    await api.getRequest(LIST_SNIPPETS)('token-1', 'octo')
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:9999/api/users/octo/gists?per_page=100&page=1')
  })

  it('rejects OAuth token exchange responses without an access token', async () => {
    const { api } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createJsonResponse({
        error: 'incorrect_client_credentials',
        error_description: 'The client credentials are incorrect.'
      }))
    })

    await expect(api.getRequest(EXCHANGE_ACCESS_TOKEN)('client-id', 'client-secret', 'auth-code'))
      .rejects.toMatchObject({
        name: 'OAuthTokenExchangeError',
        errorDescription: 'The client credentials are incorrect.',
        error: {
          error: 'incorrect_client_credentials'
        }
      })
  })

  it('reports non-json GitHub API responses as parse errors', async () => {
    const { api } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createTextResponse('<html>nope</html>'))
    })

    await expect(api.getRequest(EXCHANGE_ACCESS_TOKEN)('client-id', 'client-secret', 'auth-code'))
      .rejects.toMatchObject({
        name: 'ResponseParseError',
        error: {
          bodyPrefix: '<html>nope</html>'
        }
      })
  })

  it('uses GitHub Enterprise API host when configured', async () => {
    const { api, fetch } = loadGitHubApi({
      confValues: {
        'enterprise:enable': true,
        'enterprise:host': 'ghe.example.test'
      },
      fetchImpl: () => Promise.resolve(createJsonResponse({ login: 'octo' }))
    })

    const result = await api.getRequest(GET_USER_PROFILE)('token-1')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://ghe.example.test/api/v3/user')
    expect(init).toEqual(expect.objectContaining({
      method: 'GET'
    }))
    expect(init.headers).toEqual(expect.objectContaining({
      Accept: 'application/json',
      'User-Agent': 'lepton-snippet-app',
      Authorization: 'token token-1'
    }))
    expect(result).toEqual(expect.objectContaining({
      login: 'octo',
      providerType: 'github',
      providerBaseUrl: 'https://ghe.example.test',
      storageKey: 'github:https://ghe.example.test:octo'
    }))
  })

  it('relies on Electron session fetch when proxy configuration is enabled', async () => {
    const { api, fetch } = loadGitHubApi({
      confValues: {
        'proxy:enable': true,
        'proxy:address': 'socks://localhost:1080'
      }
    })

    await api.getRequest(GET_SNIPPET)('token-1', 'gist-1')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/gists/gist-1')
    expect(init).not.toHaveProperty('agent')
  })

  it('serializes JSON request bodies for gist creation', async () => {
    const files = {
      'hello.js': {
        content: 'console.log("hello")'
      }
    }
    const { api, fetch } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createJsonResponse({ id: 'gist-1' }))
    })

    const result = await api.getRequest(CREATE_SNIPPET)('token-1', 'description', files, false)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/gists')
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        description: 'description',
        public: false,
        files: files
      })
    }))
    expect(init.headers).toEqual(expect.objectContaining({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'lepton-snippet-app',
      Authorization: 'token token-1'
    }))
    expect(result).toEqual(expect.objectContaining({
      id: 'gist-1',
      providerType: 'github',
      providerBaseUrl: 'https://github.com'
    }))
  })

  it('handles empty delete responses', async () => {
    const { api, fetch } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createJsonResponse(null, {
        status: 204,
        statusText: 'No Content'
      }))
    })

    const result = await api.getRequest(DELETE_SNIPPET)('token-1', 'gist-1')

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/gists/gist-1')
    expect(init).toEqual(expect.objectContaining({
      method: 'DELETE'
    }))
    expect(init).not.toHaveProperty('body')
    expect(result).toBeNull()
  })

  it('requests all paginated gists and sorts newest first', async () => {
    const pages = {
      1: {
        body: [{ id: 'old', updated_at: '2020-01-01T00:00:00Z' }],
        headers: {
          link: '<https://api.github.com/users/octo/gists?page=2>; rel="last"'
        }
      },
      2: {
        body: [{ id: 'new', updated_at: '2021-01-01T00:00:00Z' }],
        headers: {
          link: ''
        }
      }
    }
    const { api, fetch } = loadGitHubApi({
      fetchImpl: (url) => {
        const page = new URL(url).searchParams.get('page')
        return Promise.resolve(createJsonResponse(pages[page].body, {
          headers: pages[page].headers
        }))
      }
    })

    const result = await api.getRequest(LIST_SNIPPETS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
    expect(fetch.mock.calls[1][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=2')
    expect(result.map(gist => gist.id)).toEqual(['new', 'old'])
  })

  it('treats a missing pagination header as a complete single-page gist response', async () => {
    const { api, fetch } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createJsonResponse([
        { id: 'single-page', updated_at: '2022-01-01T00:00:00Z' }
      ]))
    })

    const result = await api.getRequest(LIST_SNIPPETS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
    expect(result).toEqual([
      expect.objectContaining({
        id: 'single-page',
        updated_at: '2022-01-01T00:00:00Z',
        providerType: 'github'
      })
    ])
  })

  it('uses the authenticated gists endpoint when snippet downloadAll is enabled', async () => {
    const { api, fetch } = loadGitHubApi({
      confValues: {
        'snippet:downloadAll': true
      },
      fetchImpl: () => Promise.resolve(createJsonResponse([]))
    })

    await api.getRequest(LIST_SNIPPETS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/gists?per_page=100&page=1')
    expect(init.headers).toEqual(expect.objectContaining({
      'User-Agent': 'lepton-snippet-app',
      Authorization: 'token token-1'
    }))
  })

  it('ignores old gist downloadAll config for the authenticated gists endpoint', async () => {
    const { api, fetch } = loadGitHubApi({
      confValues: {
        'gist:downloadAll': true
      },
      fetchImpl: () => Promise.resolve(createJsonResponse([]))
    })

    await api.getRequest(LIST_SNIPPETS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
  })

  it('falls back to sequential V1 gist requests when V2 fetching fails', async () => {
    let shouldFailV2 = true
    const { api, fetch } = loadGitHubApi({
      fetchImpl: (url) => {
        if (shouldFailV2) {
          shouldFailV2 = false
          return Promise.reject(new Error('network unavailable'))
        }

        const page = new URL(url).searchParams.get('page')
        const body = page === '1'
          ? [{ id: 'fallback', updated_at: '2023-01-01T00:00:00Z' }]
          : []
        return Promise.resolve(createJsonResponse(body))
      }
    })

    const result = await api.getRequest(LIST_SNIPPETS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
    expect(fetch.mock.calls[1][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
    expect(fetch.mock.calls[2][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=2')
    expect(result).toEqual([
      expect.objectContaining({
        id: 'fallback',
        updated_at: '2023-01-01T00:00:00Z',
        providerType: 'github'
      })
    ])
  })

  it('rejects non-successful responses with request-compatible status fields', async () => {
    const { api } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createJsonResponse({
        message: 'Bad credentials'
      }, {
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          'x-github-request-id': 'request-1'
        }
      }))
    })

    await expect(api.getRequest(GET_USER_PROFILE)('token-1')).rejects.toMatchObject({
      name: 'StatusCodeError',
      status: 401,
      statusCode: 401,
      error: {
        message: 'Bad credentials'
      },
      response: {
        statusCode: 401,
        statusMessage: 'Unauthorized',
        headers: {
          'x-github-request-id': 'request-1'
        }
      }
    })
  })
})
