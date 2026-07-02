import { describe, expect, it } from 'vitest'
import githubOAuth from '../../app/utilities/auth/githubOAuth'

const {
  buildGitHubOAuthUrl,
  describeGitHubOAuthUrl,
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

  it('describes OAuth URLs without exposing callback codes or client ids', () => {
    expect(describeGitHubOAuthUrl('https://example.test/callback?code=secret-code&client_id=client-id&state=one'))
      .toEqual({
        valid: true,
        origin: 'https://example.test',
        pathname: '/callback',
        queryKeys: ['client_id', 'code', 'state'],
        hasCode: true,
        codeLength: 11,
        hasError: false
      })
  })

  it('describes OAuth errors without exposing the full callback URL', () => {
    expect(describeGitHubOAuthUrl('https://example.test/callback?error=access_denied&error_description=nope'))
      .toEqual({
        valid: true,
        origin: 'https://example.test',
        pathname: '/callback',
        queryKeys: ['error', 'error_description'],
        hasCode: false,
        hasError: true,
        error: 'access_denied',
        errorDescription: 'nope'
      })
  })
})
