import { afterEach, describe, expect, it, vi } from 'vitest'
import fetchAdapter from '../../app/utilities/snippetApi/fetchAdapter'

const { createFetchRequest } = fetchAdapter

function createHeaders (values = {}) {
  const normalizedValues = {}
  Object.keys(values).forEach(key => {
    normalizedValues[key.toLowerCase()] = values[key]
  })
  return {
    forEach: callback => Object.keys(normalizedValues)
      .forEach(key => callback(normalizedValues[key], key)),
    get: key => normalizedValues[key.toLowerCase()] || null
  }
}

function createResponse (body, options = {}) {
  const status = options.status === undefined ? 200 : options.status
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: options.statusText || 'OK',
    headers: createHeaders(options.headers),
    text: () => Promise.resolve(body)
  }
}

afterEach(() => vi.useRealTimers())

describe('snippet API fetch adapter', () => {
  it('builds query strings and JSON requests without dropping redirect policy', async () => {
    const fetch = vi.fn(() => Promise.resolve(createResponse('{"id":"snippet-1"}')))
    const request = createFetchRequest(fetch, { serviceName: 'Snippet' })

    await expect(request({
      uri: 'https://snippets.example.test/items',
      qs: { page: 2, search: 'hello world' },
      headers: { 'X-Request-ID': 'request-1' },
      method: 'POST',
      body: { description: 'Example' },
      json: true,
      redirect: 'error'
    })).resolves.toEqual({ id: 'snippet-1' })

    expect(fetch).toHaveBeenCalledWith(
      'https://snippets.example.test/items?page=2&search=hello+world',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Request-ID': 'request-1'
        },
        body: JSON.stringify({ description: 'Example' }),
        redirect: 'error'
      }
    )
  })

  it('serializes form requests with the expected content type', async () => {
    const fetch = vi.fn(() => Promise.resolve(createResponse('{"access_token":"token-1"}')))
    const request = createFetchRequest(fetch)

    await request({
      uri: 'https://snippets.example.test/token',
      method: 'POST',
      form: { client_id: 'client-1', code: 'code with spaces' },
      json: true
    })

    expect(fetch.mock.calls[0][1]).toEqual({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'client_id=client-1&code=code+with+spaces'
    })
  })

  it('returns empty JSON and preserves full response metadata', async () => {
    const fetch = vi.fn(() => Promise.resolve(createResponse('', {
      status: 204,
      statusText: 'No Content',
      headers: {
        Link: '<https://snippets.example.test/items?page=2>; rel="next"',
        'X-Next-Page': '2'
      }
    })))
    const request = createFetchRequest(fetch)

    await expect(request({
      uri: 'https://snippets.example.test/items',
      json: true,
      resolveWithFullResponse: true
    })).resolves.toEqual({
      body: null,
      headers: {
        link: '<https://snippets.example.test/items?page=2>; rel="next"',
        'x-next-page': '2'
      },
      statusCode: 204,
      statusMessage: 'No Content'
    })
  })

  it('reports provider-specific status errors with request-compatible fields', async () => {
    const fetch = vi.fn(() => Promise.resolve(createResponse('{"message":"Unauthorized"}', {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'X-Request-ID': 'request-401' }
    })))
    const request = createFetchRequest(fetch, { serviceName: 'GitLab' })

    await expect(request({
      uri: 'https://gitlab.example.test/api/v4/user',
      json: true
    })).rejects.toMatchObject({
      name: 'StatusCodeError',
      message: 'GitLab API request failed with status 401 Unauthorized',
      status: 401,
      statusCode: 401,
      error: { message: 'Unauthorized' },
      response: {
        body: { message: 'Unauthorized' },
        headers: { 'x-request-id': 'request-401' },
        statusCode: 401,
        statusMessage: 'Unauthorized'
      }
    })
  })

  it('reports malformed JSON with only a bounded body prefix', async () => {
    const invalidBody = '<html>' + 'x'.repeat(300)
    const fetch = vi.fn(() => Promise.resolve(createResponse(invalidBody)))
    const request = createFetchRequest(fetch, { serviceName: 'GitHub' })

    await expect(request({
      uri: 'https://api.github.com/user',
      json: true
    })).rejects.toMatchObject({
      name: 'ResponseParseError',
      message: 'GitHub API response was not valid JSON',
      statusCode: 200,
      error: { bodyPrefix: invalidBody.slice(0, 200) }
    })
  })

  it('clears request timeouts after a successful response', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(() => Promise.resolve(createResponse('{}')))
    const request = createFetchRequest(fetch)

    await request({
      uri: 'https://snippets.example.test/items',
      json: true,
      timeout: 1000
    })

    expect(vi.getTimerCount()).toBe(0)
  })
})
