import { describe, expect, it, vi } from 'vitest'
import gitlabApiCore from '../../app/utilities/gitlabApi/core'
import snippetOperations from '../../app/utilities/snippetApi/operations'

const {
  CREATE_SNIPPET,
  DELETE_SNIPPET,
  GET_SNIPPET,
  GET_USER_PROFILE,
  LIST_SNIPPETS,
  UPDATE_SNIPPET
} = snippetOperations
const { createGitLabApi, toGitLabMetadata } = gitlabApiCore

const logger = {
  debug: () => {},
  error: () => {},
  info: () => {}
}

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

function loadGitLabApi (fetchImpl, options = {}) {
  const fetch = vi.fn(fetchImpl)
  const api = createGitLabApi(Object.assign({
    fetchImpl: fetch,
    gitLabApiBaseUrl: 'https://gitlab.example.test',
    logger
  }, options))
  return { api, fetch }
}

function createSnippet (overrides = {}) {
  return Object.assign({
    id: 42,
    title: 'Example',
    description: 'A snippet #tag',
    visibility: 'private',
    author: {
      username: 'octo',
      avatar_url: 'https://gitlab.example.test/avatar.png',
      web_url: 'https://gitlab.example.test/octo'
    },
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    web_url: 'https://gitlab.example.test/-/snippets/42',
    raw_url: 'https://gitlab.example.test/-/snippets/42/raw',
    files: []
  }, overrides)
}

function createRawFileUrl (filePath, { id = 42, ref = 'main' } = {}) {
  return `https://gitlab.example.test/-/snippets/${id}/raw/${encodeURIComponent(ref)}/${filePath}`
}

describe('GitLab personal snippets API utility', () => {
  it.each(['', '   '])('rejects an explicitly blank configured GitLab host %j', host => {
    expect(() => createGitLabApi({
      conf: {
        get: key => key === 'gitlab:host' ? host : undefined
      },
      fetchImpl: vi.fn(),
      logger
    })).toThrow('Invalid gitlab provider URL')
  })

  it('rejects a malformed GitLab root container before using nested defaults', () => {
    expect(() => createGitLabApi({
      conf: {
        get: key => key === 'gitlab'
          ? false
          : key === 'gitlab:host' ? 'gitlab.com' : undefined
      },
      fetchImpl: vi.fn(),
      logger
    })).toThrow('Invalid GitLab configuration')
  })

  it('uses the visible GitLab host setting instead of a stale baseUrl alias', async () => {
    const values = {
      'gitlab:baseUrl': 'https://old.example.test',
      'gitlab:host': 'https://new.example.test'
    }
    const fetch = vi.fn(() => Promise.resolve(createJsonResponse({
      id: 7,
      username: 'octo'
    })))
    const api = createGitLabApi({
      conf: {
        get: key => values[key]
      },
      fetchImpl: fetch,
      logger
    })

    await api.getRequest(GET_USER_PROFILE)('pat-1')

    expect(fetch.mock.calls[0][0]).toBe('https://new.example.test/api/v4/user')
  })

  it('authenticates a PAT and normalizes the user profile', async () => {
    const { api, fetch } = loadGitLabApi(() => Promise.resolve(createJsonResponse({
      id: 7,
      username: 'octo',
      avatar_url: 'https://gitlab.example.test/avatar.png',
      web_url: 'https://gitlab.example.test/octo'
    })))

    const profile = await api.getRequest(GET_USER_PROFILE)('pat-1')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://gitlab.example.test/api/v4/user')
    expect(fetch.mock.calls[0][1].redirect).toBe('error')
    expect(fetch.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      Accept: 'application/json',
      'PRIVATE-TOKEN': 'pat-1',
      'User-Agent': 'lepton-snippet-app'
    }))
    expect(profile).toEqual(expect.objectContaining({
      login: 'octo',
      html_url: 'https://gitlab.example.test/octo',
      providerType: 'gitlab',
      providerBaseUrl: 'https://gitlab.example.test',
      starred_url: null,
      storageKey: 'gitlab:https://gitlab.example.test:octo'
    }))
  })

  it('rejects redirects rather than forwarding a PAT to another origin', async () => {
    const { api, fetch } = loadGitLabApi((url, init) => {
      if (init.redirect !== 'error') {
        throw new Error(`PAT could be redirected from ${url}`)
      }
      return Promise.reject(new TypeError('fetch failed: redirect mode is set to error'))
    })

    await expect(api.getRequest(GET_USER_PROFILE)('pat-1'))
      .rejects.toThrow('redirect mode is set to error')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://gitlab.example.test/api/v4/user')
    expect(fetch.mock.calls[0][1]).toEqual(expect.objectContaining({
      redirect: 'error',
      headers: expect.objectContaining({ 'PRIVATE-TOKEN': 'pat-1' })
    }))
  })

  it('paginates personal snippets and returns newest GitHub-shaped records first', async () => {
    const pages = {
      1: {
        body: [
          createSnippet({
            id: 1,
            title: 'Older',
            updated_at: '2025-01-01T00:00:00Z',
            files: [{ path: 'old.js', raw_url: createRawFileUrl('old.js', { id: 1 }) }]
          }),
          createSnippet({
            id: 99,
            project_id: 123,
            title: 'Project snippet'
          })
        ],
        nextPage: '2'
      },
      2: {
        body: [createSnippet({
          id: 2,
          title: 'Newer',
          visibility: 'public',
          updated_at: '2025-02-01T00:00:00Z',
          files: [{ path: 'README.md', raw_url: createRawFileUrl('README.md', { id: 2 }) }]
        })],
        nextPage: ''
      }
    }
    const { api, fetch } = loadGitLabApi(url => {
      const page = new URL(url).searchParams.get('page')
      return Promise.resolve(createJsonResponse(pages[page].body, {
        headers: { 'x-next-page': pages[page].nextPage }
      }))
    })

    const snippets = await api.getRequest(LIST_SNIPPETS)('pat-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(snippets.map(snippet => snippet.id)).toEqual(['2', '1'])
    expect(snippets[0]).toEqual(expect.objectContaining({
      description: '[Newer] A snippet #tag',
      public: true,
      html_url: 'https://gitlab.example.test/-/snippets/42',
      history_url: null,
      providerType: 'gitlab'
    }))
    expect(snippets[0].files['README.md']).toEqual(expect.objectContaining({
      filename: 'README.md',
      language: 'Markdown',
      raw_url: createRawFileUrl('README.md', { id: 2 }),
      html_url: 'https://gitlab.example.test/-/snippets/42'
    }))
  })

  it('follows same-instance snippet pagination links', async () => {
    const { api, fetch } = loadGitLabApi(url => {
      const page = new URL(url).searchParams.get('page')
      if (page === '2') {
        return Promise.resolve(createJsonResponse([createSnippet({ id: 2 })]))
      }
      return Promise.resolve(createJsonResponse([createSnippet({ id: 1 })], {
        headers: {
          link: '<https://gitlab.example.test/api/v4/snippets?page=2&per_page=100>; rel="next"'
        }
      }))
    })

    const snippets = await api.getRequest(LIST_SNIPPETS)('pat-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toBe('https://gitlab.example.test/api/v4/snippets?page=2&per_page=100')
    expect(snippets.map(snippet => snippet.id)).toEqual(['1', '2'])
  })

  it('never follows pagination links outside the configured GitLab API', async () => {
    const { api, fetch } = loadGitLabApi(() => Promise.resolve(createJsonResponse([
      createSnippet({ id: 1 })
    ], {
      headers: {
        link: '<https://attacker.example/snippets?page=2>; rel="next"'
      }
    })))

    await api.getRequest(LIST_SNIPPETS)('pat-1', 'octo')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1].headers['PRIVATE-TOKEN']).toBe('pat-1')
  })

  it('identifies notebook files for rich rendering', () => {
    const snippet = gitlabApiCore.normalizeGitLabSnippet(createSnippet({
      files: [{ path: 'demo.ipynb', raw_url: createRawFileUrl('demo.ipynb') }]
    }), { type: 'gitlab', baseUrl: 'https://gitlab.example.test' }, 'https://gitlab.example.test/api/v4')

    expect(snippet.files['demo.ipynb'].language).toBe('Jupyter Notebook')
  })

  it('preserves structured metadata and internal visibility', () => {
    const { normalizeGitLabSnippet } = gitlabApiCore
    const snippet = normalizeGitLabSnippet(createSnippet({
      title: 'Arrays',
      description: 'Use arr[index] safely',
      visibility: 'internal'
    }), { type: 'gitlab', baseUrl: 'https://gitlab.example.test' }, 'https://gitlab.example.test/api/v4')

    expect(snippet).toEqual(expect.objectContaining({
      public: false,
      visibility: 'internal',
      providerTitle: 'Arrays',
      providerDescription: 'Use arr[index] safely'
    }))
  })

  it('preserves files whose paths match object prototype property names', () => {
    const { normalizeGitLabSnippet } = gitlabApiCore
    const contents = Object.create(null)
    contents.__proto__ = 'prototype-safe content'
    const snippet = normalizeGitLabSnippet(createSnippet({
      files: [{ path: '__proto__', raw_url: createRawFileUrl('__proto__') }]
    }), { type: 'gitlab', baseUrl: 'https://gitlab.example.test' }, 'https://gitlab.example.test/api/v4', contents)

    expect(Object.keys(snippet.files)).toEqual(['__proto__'])
    expect(Object.prototype.hasOwnProperty.call(snippet.files, '__proto__')).toBe(true)
    expect(snippet.files.__proto__.content).toBe('prototype-safe content')
  })

  it('hydrates every file from its returned raw URL without guessing a branch', async () => {
    const snippet = createSnippet({
      files: [
        { path: 'src/a.js', raw_url: createRawFileUrl('src/a.js', { ref: 'release-2025' }) },
        { path: 'notes.md', raw_url: createRawFileUrl('notes.md', { ref: 'feature/docs' }) }
      ]
    })
    const { api, fetch } = loadGitLabApi(url => {
      if (url.endsWith('/snippets/42')) return Promise.resolve(createJsonResponse(snippet))
      if (url.endsWith('/snippets/42/files/release-2025/src%2Fa.js/raw')) {
        return Promise.resolve(createTextResponse('const a = 1'))
      }
      if (url.endsWith('/snippets/42/files/feature%2Fdocs/notes.md/raw')) {
        return Promise.resolve(createTextResponse('# Notes'))
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const result = await api.getRequest(GET_SNIPPET)('pat-1', '42')

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls.slice(1).map(call => call[0])).toEqual([
      'https://gitlab.example.test/api/v4/snippets/42/files/release-2025/src%2Fa.js/raw',
      'https://gitlab.example.test/api/v4/snippets/42/files/feature%2Fdocs/notes.md/raw'
    ])
    expect(fetch.mock.calls[1][1].headers['PRIVATE-TOKEN']).toBe('pat-1')
    expect(result.files['src/a.js']).toEqual(expect.objectContaining({
      content: 'const a = 1',
      size: 11,
      language: 'JavaScript'
    }))
    expect(result.files['notes.md'].content).toBe('# Notes')
  })

  it('uses the authenticated legacy raw endpoint for a single-file snippet', async () => {
    const snippet = createSnippet({
      file_name: 'legacy.txt',
      files: undefined
    })
    const { api, fetch } = loadGitLabApi(url => {
      if (url.endsWith('/snippets/42')) return Promise.resolve(createJsonResponse(snippet))
      if (url.endsWith('/snippets/42/raw')) return Promise.resolve(createTextResponse('legacy content'))
      throw new Error(`Unexpected URL ${url}`)
    })

    const result = await api.getRequest(GET_SNIPPET)('pat-1', '42')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toBe('https://gitlab.example.test/api/v4/snippets/42/raw')
    expect(result.files['legacy.txt'].content).toBe('legacy content')
  })

  it('does not guess a ref when multi-file metadata omits raw URLs', async () => {
    const snippet = createSnippet({
      files: [
        { path: 'src/a.js' },
        { path: 'notes.md' }
      ]
    })
    const { api, fetch } = loadGitLabApi(() => Promise.resolve(createJsonResponse(snippet)))

    const result = await api.getRequest(GET_SNIPPET)('pat-1', '42')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.files['src/a.js']).not.toHaveProperty('content')
    expect(result.files['notes.md']).not.toHaveProperty('content')
  })

  it('maps GitHub-style create arguments to the GitLab multi-file payload', async () => {
    const snippet = createSnippet({
      id: 77,
      title: 'New snippet',
      description: 'Details #tag',
      files: [{ path: 'hello.js', raw_url: createRawFileUrl('hello.js', { id: 77 }) }]
    })
    const { api, fetch } = loadGitLabApi((url, init) => {
      if (init.method === 'POST') return Promise.resolve(createJsonResponse(snippet, { status: 201, statusText: 'Created' }))
      throw new Error(`Unexpected ${init.method} ${url}`)
    })

    const result = await api.getRequest(CREATE_SNIPPET)(
      'pat-1',
      '[New snippet] Details #tag',
      { 'hello.js': { content: 'console.log("hello")' } },
      false
    )

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://gitlab.example.test/api/v4/snippets')
    expect(JSON.parse(init.body)).toEqual({
      title: 'New snippet',
      description: 'Details #tag',
      visibility: 'private',
      files: [{
        file_path: 'hello.js',
        content: 'console.log("hello")'
      }]
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.files['hello.js'].content).toBe('console.log("hello")')
  })

  it('maps edits to explicit GitLab create, update, and delete file actions', async () => {
    const existingSnippet = createSnippet({
      files: [
        { path: 'keep.js', raw_url: createRawFileUrl('keep.js') },
        { path: 'remove.txt', raw_url: createRawFileUrl('remove.txt') }
      ]
    })
    const updatedSnippet = createSnippet({
      title: 'Updated',
      description: 'After edit',
      files: [
        { path: 'keep.js', raw_url: createRawFileUrl('keep.js') },
        { path: 'new.md', raw_url: createRawFileUrl('new.md') }
      ]
    })
    const { api, fetch } = loadGitLabApi((url, init) => {
      if (url.endsWith('/snippets/42') && init.method === 'GET') {
        return Promise.resolve(createJsonResponse(existingSnippet))
      }
      if (url.endsWith('/snippets/42') && init.method === 'PUT') {
        return Promise.resolve(createJsonResponse(updatedSnippet))
      }
      throw new Error(`Unexpected ${init.method} ${url}`)
    })

    const result = await api.getRequest(UPDATE_SNIPPET)(
      'pat-1',
      '42',
      '[Updated] After edit',
      {
        'keep.js': { content: 'updated' },
        'new.md': { content: '# new' },
        'remove.txt': null
      }
    )

    const updateCall = fetch.mock.calls.find(([, init]) => init.method === 'PUT')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(updateCall[1].body)).toEqual({
      title: 'Updated',
      description: 'After edit',
      files: [
        { action: 'update', file_path: 'keep.js', content: 'updated' },
        { action: 'create', file_path: 'new.md', content: '# new' },
        { action: 'delete', file_path: 'remove.txt' }
      ]
    })
    expect(result.files['keep.js'].content).toBe('updated')
    expect(result.files['new.md'].content).toBe('# new')
  })

  it('parses only the leading title marker and preserves ordinary bracket text', () => {
    expect(toGitLabMetadata('[Title] Uses arr[index] safely', 'code.js')).toEqual({
      title: 'Title',
      description: 'Uses arr[index] safely'
    })
  })

  it('parses balanced brackets in a newly created snippet title', () => {
    expect(toGitLabMetadata('[API [v2]] Notes', 'code.js')).toEqual({
      title: 'API [v2]',
      description: 'Notes'
    })
  })

  it('round-trips an existing native GitLab title containing a closing bracket', () => {
    expect(toGitLabMetadata('[API [v2]] Notes', 'code.js', 'API [v2]')).toEqual({
      title: 'API [v2]',
      description: 'Notes'
    })
  })

  it('keeps an unmarked long description intact and derives the title from the filename', () => {
    const description = 'x'.repeat(300)

    expect(toGitLabMetadata(description, 'notes.md')).toEqual({
      title: 'notes.md',
      description
    })
  })

  it('deletes snippets and reports GitLab-specific HTTP errors', async () => {
    const success = loadGitLabApi(() => Promise.resolve(createJsonResponse(null, {
      status: 204,
      statusText: 'No Content'
    })))

    await expect(success.api.getRequest(DELETE_SNIPPET)('pat-1', '42')).resolves.toBeNull()
    expect(success.fetch.mock.calls[0][1].method).toBe('DELETE')

    const failure = loadGitLabApi(() => Promise.resolve(createJsonResponse({
      message: '401 Unauthorized'
    }, {
      status: 401,
      statusText: 'Unauthorized'
    })))

    await expect(failure.api.getRequest(GET_USER_PROFILE)('bad-pat')).rejects.toMatchObject({
      name: 'StatusCodeError',
      message: 'GitLab API request failed with status 401 Unauthorized',
      statusCode: 401
    })
  })
})
