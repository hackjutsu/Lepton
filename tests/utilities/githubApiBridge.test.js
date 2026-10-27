import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGitHubApi } from '../../app/utilities/githubApi'
import { setSnippetProvider } from '../../app/utilities/snippetApi'
import snippetOperations from '../../app/utilities/snippetApi/operations'

const { GET_USER_PROFILE } = snippetOperations

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

describe('legacy GitHub API renderer wrapper', () => {
  beforeEach(() => {
    snippetRequest.mockReset()
    setSnippetProvider({ type: 'github', baseUrl: 'https://github.com' })
  })

  it('routes requests through the provider-neutral snippet bridge', async () => {
    snippetRequest.mockResolvedValue({
      __leptonSnippetApiBridgeResponse: true,
      ok: true,
      data: {
        login: 'octo'
      }
    })
    setSnippetProvider({ type: 'gitlab', baseUrl: 'gitlab.example.test/' })

    await expect(getGitHubApi(GET_USER_PROFILE)('token-1')).resolves.toEqual({
      login: 'octo'
    })
    expect(snippetRequest).toHaveBeenCalledWith(
      { type: 'github', baseUrl: 'https://github.com' },
      GET_USER_PROFILE,
      ['token-1']
    )
  })

  it('restores serialized provider errors', async () => {
    snippetRequest.mockResolvedValue({
      __leptonSnippetApiBridgeResponse: true,
      ok: false,
      error: {
        message: 'GitHub API request failed with status 401 Unauthorized',
        name: 'StatusCodeError',
        statusCode: 401,
        error: {
          message: 'Bad credentials'
        }
      }
    })

    await expect(getGitHubApi(GET_USER_PROFILE)('token-1')).rejects.toMatchObject({
      name: 'StatusCodeError',
      message: 'GitHub API request failed with status 401 Unauthorized',
      statusCode: 401,
      error: {
        message: 'Bad credentials'
      }
    })
  })

  it('passes through raw snippet bridge responses', async () => {
    snippetRequest.mockResolvedValue({
      login: 'octo'
    })

    await expect(getGitHubApi(GET_USER_PROFILE)('token-1')).resolves.toEqual({
      login: 'octo'
    })
  })
})
