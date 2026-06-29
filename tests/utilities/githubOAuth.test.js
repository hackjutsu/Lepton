import { describe, expect, it } from 'vitest'
import githubOAuth from '../../app/utilities/auth/githubOAuth'

const {
  buildGitHubOAuthUrl,
  parseGitHubOAuthCallback
} = githubOAuth

describe('GitHub OAuth utility', () => {
  it('builds the GitHub OAuth authorize URL', () => {
    const url = buildGitHubOAuthUrl({
      clientId: 'client-id',
      scopes: ['gist', 'repo']
    })

    expect(url).toBe('https://github.com/login/oauth/authorize?client_id=client-id&scope=gist+repo')
  })

  it('parses successful callback codes', () => {
    expect(parseGitHubOAuthCallback('https://example.test/callback?code=auth-code&state=one'))
      .toEqual({
        status: 'success',
        code: 'auth-code'
      })
  })

  it('parses callback errors', () => {
    expect(parseGitHubOAuthCallback('https://example.test/callback?error=access_denied&error_description=nope'))
      .toEqual({
        status: 'error',
        error: 'access_denied',
        errorDescription: 'nope'
      })
  })

  it('ignores URLs without OAuth callback data', () => {
    expect(parseGitHubOAuthCallback('https://github.com/login')).toBeNull()
    expect(parseGitHubOAuthCallback('not a url')).toBeNull()
  })
})
