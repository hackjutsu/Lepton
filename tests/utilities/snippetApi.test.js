import { describe, expect, it, vi } from 'vitest'
import githubApiCore from '../../app/utilities/githubApi/core'
import snippetApiCore from '../../app/utilities/snippetApi/core'
import snippetOperations from '../../app/utilities/snippetApi/operations'

const {
  normalizeGitHubSnippet
} = githubApiCore
const {
  GET_SNIPPET,
  GET_USER_PROFILE
} = snippetOperations
const { createSnippetApi } = snippetApiCore

function createHeaders (values = {}) {
  const normalizedValues = {}
  Object.keys(values).forEach(key => {
    normalizedValues[key.toLowerCase()] = values[key]
  })
  return {
    forEach: callback => {
      Object.keys(normalizedValues).forEach(key => callback(normalizedValues[key], key))
    },
    get: key => normalizedValues[key.toLowerCase()] || null
  }
}

function createResponse (body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: createHeaders(),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
  }
}

function createConf (values = {}) {
  return {
    get: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined
  }
}

describe('snippet API provider router', () => {
  it('does not let provider options replace validated routing inputs', () => {
    const conf = createConf()
    const fetchImpl = vi.fn()
    const logger = { debug: vi.fn() }
    const githubFactory = vi.fn(options => ({
      type: 'github',
      getRequest: () => () => options
    }))
    const snippetApi = createSnippetApi({
      conf,
      fetchImpl,
      logger,
      providerFactories: { github: githubFactory },
      providerOptions: {
        github: {
          conf: 'untrusted-conf',
          fetchImpl: 'untrusted-fetch',
          gitHubApiBaseUrl: 'http://127.0.0.1:9999/api',
          logger: 'untrusted-logger',
          provider: { type: 'github', baseUrl: 'https://attacker.example' }
        }
      }
    })

    const options = snippetApi.getSnippetApi({ type: 'github' }, GET_USER_PROFILE)()

    expect(options).toEqual({
      conf,
      fetchImpl,
      gitHubApiBaseUrl: 'http://127.0.0.1:9999/api',
      logger,
      provider: { type: 'github', baseUrl: 'https://github.com' }
    })
  })

  it('routes GitHub calls with API overrides and adds provider metadata', async () => {
    const fetch = vi.fn(() => Promise.resolve(createResponse({
      login: 'octo',
      html_url: 'https://github.com/octo'
    })))
    const snippetApi = createSnippetApi({
      conf: createConf({ provider: { type: 'github' } }),
      fetchImpl: fetch,
      providerOptions: {
        github: {
          gitHubApiBaseUrl: 'http://127.0.0.1:9999/api'
        }
      }
    })

    const profile = await snippetApi.getSnippetApi({ type: 'github' }, GET_USER_PROFILE)('token-1')

    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:9999/api/user')
    expect(profile).toEqual(expect.objectContaining({
      providerType: 'github',
      providerBaseUrl: 'https://github.com',
      starred_url: 'https://gist.github.com/octo/starred',
      storageKey: 'github:https://github.com:octo'
    }))
  })

  it('adds GitHub history and file web URLs without changing the core payload', async () => {
    const fetch = vi.fn(() => Promise.resolve(createResponse({
      id: 'gist-1',
      html_url: 'https://gist.github.com/octo/gist-1',
      owner: { login: 'octo' },
      files: {
        'hello.js': {
          filename: 'hello.js',
          raw_url: 'https://gist.githubusercontent.com/raw/hello.js'
        }
      }
    })))
    const snippetApi = createSnippetApi({
      conf: createConf(),
      fetchImpl: fetch
    })

    const snippet = await snippetApi.getSnippetApi({ type: 'github' }, GET_SNIPPET)('token-1', 'gist-1')

    expect(snippet.history_url).toBe('https://gist.github.com/octo/gist-1/revisions')
    expect(snippet.files['hello.js']).toEqual(expect.objectContaining({
      raw_url: 'https://gist.githubusercontent.com/raw/hello.js',
      html_url: 'https://gist.github.com/octo/gist-1#file-hello-js',
      providerType: 'github'
    }))
  })

  it('preserves GitHub files whose names match object prototype properties', () => {
    const files = Object.create(null)
    files.__proto__ = {
      filename: '__proto__',
      content: 'prototype-safe content'
    }
    const snippet = normalizeGitHubSnippet({
      id: 'gist-1',
      html_url: 'https://gist.github.com/octo/gist-1',
      owner: { login: 'octo' },
      files
    }, { type: 'github', baseUrl: 'https://github.com' })

    expect(Object.keys(snippet.files)).toEqual(['__proto__'])
    expect(Object.prototype.hasOwnProperty.call(snippet.files, '__proto__')).toBe(true)
    expect(snippet.files.__proto__.content).toBe('prototype-safe content')
  })

  it('routes GitLab calls through the configured API base URL', async () => {
    const fetch = vi.fn(() => Promise.resolve(createResponse({
      username: 'octo',
      web_url: 'https://gitlab.example.test/octo'
    })))
    const snippetApi = createSnippetApi({
      conf: createConf({
        provider: { type: 'gitlab' },
        'gitlab:host': 'gitlab.example.test'
      }),
      fetchImpl: fetch,
      providerOptions: {
        gitlab: {
          gitLabApiBaseUrl: 'http://127.0.0.1:9998/api/v4'
        }
      }
    })

    const profile = await snippetApi.getSnippetApi({
      type: 'gitlab',
      baseUrl: 'gitlab.example.test'
    }, GET_USER_PROFILE)('pat-1')

    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:9998/api/v4/user')
    expect(fetch.mock.calls[0][1].headers['PRIVATE-TOKEN']).toBe('pat-1')
    expect(profile).toEqual(expect.objectContaining({
      login: 'octo',
      providerType: 'gitlab',
      providerBaseUrl: 'https://gitlab.example.test',
      starred_url: null
    }))
  })
})
