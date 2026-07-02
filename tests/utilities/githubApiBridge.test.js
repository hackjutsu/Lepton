import { beforeEach, describe, expect, it, vi } from 'vitest'

const githubRequest = vi.hoisted(() => vi.fn())

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    github: {
      request: githubRequest
    }
  }
}))

import {
  GET_USER_PROFILE,
  getGitHubApi
} from '../../app/utilities/githubApi'

describe('GitHub API renderer bridge', () => {
  beforeEach(() => {
    githubRequest.mockReset()
  })

  it('unwraps successful GitHub API bridge responses', async () => {
    githubRequest.mockResolvedValue({
      __leptonGitHubApiBridgeResponse: true,
      ok: true,
      data: {
        login: 'octo'
      }
    })

    await expect(getGitHubApi(GET_USER_PROFILE)('token-1')).resolves.toEqual({
      login: 'octo'
    })
    expect(githubRequest).toHaveBeenCalledWith(GET_USER_PROFILE, ['token-1'])
  })

  it('rejects failed GitHub API bridge responses with serialized details', async () => {
    githubRequest.mockResolvedValue({
      __leptonGitHubApiBridgeResponse: true,
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

  it('passes through legacy raw bridge responses', async () => {
    githubRequest.mockResolvedValue({
      login: 'octo'
    })

    await expect(getGitHubApi(GET_USER_PROFILE)('token-1')).resolves.toEqual({
      login: 'octo'
    })
  })
})
