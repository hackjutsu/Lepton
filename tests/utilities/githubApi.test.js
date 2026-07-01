import { describe, expect, it, vi } from 'vitest'
import githubApiCore from '../../app/utilities/githubApi/core'

const {
  CREATE_SINGLE_GIST,
  DELETE_SINGLE_GIST,
  EXCHANGE_ACCESS_TOKEN,
  GET_ALL_GISTS,
  GET_SINGLE_GIST,
  GET_USER_PROFILE,
  createGitHubApi
} = githubApiCore

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
  it('builds the OAuth access-token exchange request', async () => {
    const { api, fetch } = loadGitHubApi()

    await api.getGitHubApi(EXCHANGE_ACCESS_TOKEN)('client-id', 'client-secret', 'auth-code')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://github.com/login/oauth/access_token')
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      body: 'client_id=client-id&client_secret=client-secret&code=auth-code'
    }))
    expect(init.headers).toEqual(expect.objectContaining({
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    }))
    expect(init).not.toHaveProperty('agent')
  })

  it('uses GitHub Enterprise API host when configured', async () => {
    const { api, fetch } = loadGitHubApi({
      confValues: {
        'enterprise:enable': true,
        'enterprise:host': 'ghe.example.test'
      },
      fetchImpl: () => Promise.resolve(createJsonResponse({ login: 'octo' }))
    })

    const result = await api.getGitHubApi(GET_USER_PROFILE)('token-1')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://ghe.example.test/api/v3/user')
    expect(init).toEqual(expect.objectContaining({
      method: 'GET'
    }))
    expect(init.headers).toEqual(expect.objectContaining({
      Accept: 'application/json',
      'User-Agent': 'hackjutsu-lepton-app',
      Authorization: 'token token-1'
    }))
    expect(result).toEqual({ login: 'octo' })
  })

  it('relies on Electron session fetch when proxy configuration is enabled', async () => {
    const { api, fetch } = loadGitHubApi({
      confValues: {
        'proxy:enable': true,
        'proxy:address': 'socks://localhost:1080'
      }
    })

    await api.getGitHubApi(GET_SINGLE_GIST)('token-1', 'gist-1')

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

    const result = await api.getGitHubApi(CREATE_SINGLE_GIST)('token-1', 'description', files, false)

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
      'User-Agent': 'hackjutsu-lepton-app',
      Authorization: 'token token-1'
    }))
    expect(result).toEqual({ id: 'gist-1' })
  })

  it('handles empty delete responses', async () => {
    const { api, fetch } = loadGitHubApi({
      fetchImpl: () => Promise.resolve(createJsonResponse(null, {
        status: 204,
        statusText: 'No Content'
      }))
    })

    const result = await api.getGitHubApi(DELETE_SINGLE_GIST)('token-1', 'gist-1')

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

    const result = await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

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

    const result = await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
    expect(result).toEqual([{ id: 'single-page', updated_at: '2022-01-01T00:00:00Z' }])
  })

  it('uses the authenticated gists endpoint when downloadAll is enabled', async () => {
    const { api, fetch } = loadGitHubApi({
      confValues: {
        'snippet:downloadAll': true
      },
      fetchImpl: () => Promise.resolve(createJsonResponse([]))
    })

    await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/gists?per_page=100&page=1')
    expect(init.headers).toEqual(expect.objectContaining({
      'User-Agent': 'hackjutsu-lepton-app',
      Authorization: 'token token-1'
    }))
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

    const result = await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
    expect(fetch.mock.calls[1][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=1')
    expect(fetch.mock.calls[2][0]).toBe('https://api.github.com/users/octo/gists?per_page=100&page=2')
    expect(result).toEqual([{ id: 'fallback', updated_at: '2023-01-01T00:00:00Z' }])
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

    await expect(api.getGitHubApi(GET_USER_PROFILE)('token-1')).rejects.toMatchObject({
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
