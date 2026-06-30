import { describe, expect, it, vi } from 'vitest'
import githubApiCore from '../../app/utilities/githubApi/core'

const {
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

function loadGitHubApi ({
  confValues = {},
  requestImpl,
  requestPromiseImpl
} = {}) {
  const requestPromise = vi.fn(requestPromiseImpl || (() => Promise.resolve({})))
  const request = vi.fn(requestImpl || (() => {}))
  const proxyAgentInstances = []
  const ProxyAgent = vi.fn(function ProxyAgent (uri) {
    this.uri = uri
    proxyAgentInstances.push(this)
  })

  const api = createGitHubApi({
    conf: createConf(confValues),
    logger,
    ProxyAgentImpl: ProxyAgent,
    requestImpl: request,
    requestPromiseImpl: requestPromise
  })

  return {
    api,
    ProxyAgent,
    proxyAgentInstances,
    request,
    requestPromise
  }
}

describe('GitHub API utility', () => {
  it('builds the OAuth access-token exchange request', async () => {
    const { api, requestPromise } = loadGitHubApi()

    await api.getGitHubApi(EXCHANGE_ACCESS_TOKEN)('client-id', 'client-secret', 'auth-code')

    expect(requestPromise).toHaveBeenCalledWith({
      method: 'POST',
      uri: 'https://github.com/login/oauth/access_token',
      agent: null,
      form: {
        client_id: 'client-id',
        client_secret: 'client-secret',
        code: 'auth-code'
      },
      json: true,
      timeout: 20000
    })
  })

  it('uses GitHub Enterprise API host when configured', async () => {
    const { api, requestPromise } = loadGitHubApi({
      confValues: {
        'enterprise:enable': true,
        'enterprise:host': 'ghe.example.test'
      }
    })

    await api.getGitHubApi(GET_USER_PROFILE)('token-1')

    expect(requestPromise).toHaveBeenCalledWith(expect.objectContaining({
      uri: 'https://ghe.example.test/api/v3/user',
      headers: {
        'User-Agent': 'hackjutsu-lepton-app',
        Authorization: 'token token-1'
      },
      method: 'GET',
      json: true,
      timeout: 20000
    }))
  })

  it('wires proxy configuration into requests', async () => {
    const { api, ProxyAgent, proxyAgentInstances, requestPromise } = loadGitHubApi({
      confValues: {
        'proxy:enable': true,
        'proxy:address': 'socks://localhost:1080'
      }
    })

    await api.getGitHubApi(GET_SINGLE_GIST)('token-1', 'gist-1')

    expect(ProxyAgent).toHaveBeenCalledWith('socks://localhost:1080')
    expect(requestPromise).toHaveBeenCalledWith(expect.objectContaining({
      uri: 'https://api.github.com/gists/gist-1',
      agent: proxyAgentInstances[0]
    }))
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
    const { api, requestPromise } = loadGitHubApi({
      requestPromiseImpl: (options) => Promise.resolve(pages[options.qs.page])
    })

    const result = await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

    expect(requestPromise).toHaveBeenCalledTimes(2)
    expect(requestPromise).toHaveBeenNthCalledWith(1, expect.objectContaining({
      uri: 'https://api.github.com/users/octo/gists',
      qs: { per_page: 100, page: 1 },
      resolveWithFullResponse: true
    }))
    expect(requestPromise).toHaveBeenNthCalledWith(2, expect.objectContaining({
      qs: { per_page: 100, page: 2 }
    }))
    expect(result.map(gist => gist.id)).toEqual(['new', 'old'])
  })

  it('treats a missing pagination header as a complete single-page gist response', async () => {
    const { api, request, requestPromise } = loadGitHubApi({
      requestPromiseImpl: () => Promise.resolve({
        body: [{ id: 'single-page', updated_at: '2022-01-01T00:00:00Z' }],
        headers: {}
      }),
      requestImpl: (options, callback) => {
        const body = options.qs.page === 1
          ? [{ id: 'fallback', updated_at: '2022-01-01T00:00:00Z' }]
          : []
        callback(null, {}, body)
      }
    })

    const result = await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

    expect(requestPromise).toHaveBeenCalledWith(expect.objectContaining({
      uri: 'https://api.github.com/users/octo/gists',
      qs: { per_page: 100, page: 1 }
    }))
    expect(request).not.toHaveBeenCalled()
    expect(result).toEqual([{ id: 'single-page', updated_at: '2022-01-01T00:00:00Z' }])
  })

  it('uses the authenticated gists endpoint when snippet downloadAll is enabled', async () => {
    const { api, requestPromise } = loadGitHubApi({
      confValues: {
        'snippet:downloadAll': true
      },
      requestPromiseImpl: () => Promise.resolve({
        body: [],
        headers: {}
      })
    })

    await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

    expect(requestPromise).toHaveBeenCalledWith(expect.objectContaining({
      uri: 'https://api.github.com/gists',
      headers: {
        'User-Agent': 'hackjutsu-lepton-app',
        Authorization: 'token token-1'
      },
      qs: { per_page: 100, page: 1 },
      resolveWithFullResponse: true
    }))
  })

  it('keeps gist downloadAll as a legacy fallback for the authenticated gists endpoint', async () => {
    const { api, requestPromise } = loadGitHubApi({
      confValues: {
        'gist:downloadAll': true
      },
      requestPromiseImpl: () => Promise.resolve({
        body: [],
        headers: {}
      })
    })

    await api.getGitHubApi(GET_ALL_GISTS)('token-1', 'octo')

    expect(requestPromise).toHaveBeenCalledWith(expect.objectContaining({
      uri: 'https://api.github.com/gists',
      qs: { per_page: 100, page: 1 }
    }))
  })
})
