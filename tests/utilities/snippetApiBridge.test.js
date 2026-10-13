import { beforeEach, describe, expect, it, vi } from 'vitest'

const snippetRequest = vi.hoisted(() => vi.fn())

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    config: {
      get: (key) => key === 'provider:type' ? 'github' : undefined
    },
    snippets: {
      request: snippetRequest
    }
  }
}))

import {
  GET_USER_PROFILE,
  getSnippetApi,
  getSnippetProvider,
  setSnippetProvider
} from '../../app/utilities/snippetApi'

describe('snippet API renderer bridge', () => {
  beforeEach(() => {
    snippetRequest.mockReset()
    setSnippetProvider({ type: 'github', baseUrl: 'https://github.com' })
  })

  it('sends the normalized provider with each request', async () => {
    snippetRequest.mockResolvedValue({
      __leptonSnippetApiBridgeResponse: true,
      ok: true,
      data: { login: 'octo' }
    })

    setSnippetProvider({ type: 'gitlab', baseUrl: 'gitlab.example.test/' })

    await expect(getSnippetApi(GET_USER_PROFILE)('token-1')).resolves.toEqual({ login: 'octo' })
    expect(getSnippetProvider()).toEqual({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test'
    })
    expect(snippetRequest).toHaveBeenCalledWith(
      { type: 'gitlab', baseUrl: 'https://gitlab.example.test' },
      GET_USER_PROFILE,
      ['token-1']
    )
  })

  it('restores serialized provider errors', async () => {
    snippetRequest.mockResolvedValue({
      __leptonSnippetApiBridgeResponse: true,
      ok: false,
      error: {
        message: 'GitLab API request failed with status 401 Unauthorized',
        name: 'StatusCodeError',
        statusCode: 401
      }
    })

    await expect(getSnippetApi(GET_USER_PROFILE)('bad-token')).rejects.toMatchObject({
      name: 'StatusCodeError',
      statusCode: 401
    })
  })

  it('keeps a request bound to the provider active when it was created', async () => {
    snippetRequest.mockResolvedValue({
      __leptonSnippetApiBridgeResponse: true,
      ok: true,
      data: { login: 'octo' }
    })
    const request = getSnippetApi(GET_USER_PROFILE)

    setSnippetProvider({ type: 'gitlab', baseUrl: 'https://gitlab.example.test' })
    await request('github-token')

    expect(snippetRequest).toHaveBeenCalledWith(
      { type: 'github', baseUrl: 'https://github.com' },
      GET_USER_PROFILE,
      ['github-token']
    )
  })
})
