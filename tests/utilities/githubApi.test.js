import { afterEach, describe, expect, it, vi } from 'vitest'

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

async function loadGitHubApi ({
  confValues = {},
  requestImpl,
  requestPromiseImpl
} = {}) {
  vi.resetModules()

  const requestPromise = vi.fn(requestPromiseImpl || (() => Promise.resolve({})))
  const request = vi.fn(requestImpl || (() => {}))
  const proxyAgentInstances = []
  const ProxyAgent = vi.fn(function ProxyAgent (uri) {
    this.uri = uri
    proxyAgentInstances.push(this)
  })

  vi.doMock('../../app/utilities/electronBridge', () => ({
    default: {
      config: createConf(confValues),
      logger
    }
  }))
  vi.doMock('proxy-agent', () => ({
    default: ProxyAgent
  }))
  vi.doMock('request-promise', () => ({
    default: requestPromise
  }))
  vi.doMock('request', () => ({
    default: request
  }))

  const api = await import('../../app/utilities/githubApi')

  return {
    api,
    ProxyAgent,
    proxyAgentInstances,
    request,
    requestPromise
  }
}

afterEach(() => {
  vi.doUnmock('../../app/utilities/electronBridge')
  vi.doUnmock('proxy-agent')
  vi.doUnmock('request')
  vi.doUnmock('request-promise')
})

describe('GitHub API utility', () => {
  it('builds the OAuth access-token exchange request', async () => {
    const { api, requestPromise } = await loadGitHubApi()

    await api.getGitHubApi(api.EXCHANGE_ACCESS_TOKEN)('client-id', 'client-secret', 'auth-code')

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
    const { api, requestPromise } = await loadGitHubApi({
      confValues: {
        'enterprise:enable': true,
        'enterprise:host': 'ghe.example.test'
      }
    })

    await api.getGitHubApi(api.GET_USER_PROFILE)('token-1')

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
    const { api, ProxyAgent, proxyAgentInstances, requestPromise } = await loadGitHubApi({
      confValues: {
        'proxy:enable': true,
        'proxy:address': 'socks://localhost:1080'
      }
    })

    await api.getGitHubApi(api.GET_SINGLE_GIST)('token-1', 'gist-1')

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
    const { api, requestPromise } = await loadGitHubApi({
      requestPromiseImpl: (options) => Promise.resolve(pages[options.qs.page])
    })

    const result = await api.getGitHubApi(api.GET_ALL_GISTS)('token-1', 'octo')

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

  it('falls back to the sequential gist request path when pagination headers are missing', async () => {
    const { api, request } = await loadGitHubApi({
      requestPromiseImpl: () => Promise.resolve({
        body: [],
        headers: {}
      }),
      requestImpl: (options, callback) => {
        const body = options.qs.page === 1
          ? [{ id: 'fallback', updated_at: '2022-01-01T00:00:00Z' }]
          : []
        callback(null, {}, body)
      }
    })

    const result = await api.getGitHubApi(api.GET_ALL_GISTS)('token-1', 'octo')

    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      uri: 'https://api.github.com/users/octo/gists',
      qs: { per_page: 100, page: 1 }
    }), expect.any(Function))
    expect(result).toEqual([{ id: 'fallback', updated_at: '2022-01-01T00:00:00Z' }])
  })
})
