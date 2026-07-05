import { describe, expect, it } from 'vitest'
import githubOAuth from '../../app/utilities/auth/githubOAuth'

const {
  buildGitHubOAuthUrl,
  describeGitHubOAuthUrl,
  parseGitHubOAuthCallback,
  shouldIgnoreGitHubOAuthLoadFailure,
  shouldDisableGitHubOAuthHardwareAccelerationWorkaround,
  getGitHubOAuthDisabledChromiumFeaturesWorkaround,
  shouldSandboxGitHubOAuthWindow
} = githubOAuth

describe('GitHub OAuth utility', () => {
  it('builds the GitHub OAuth authorize URL', () => {
    const url = buildGitHubOAuthUrl({
      clientId: 'client-id',
      scopes: ['gist', 'repo']
    })

    expect(url).toBe('https://github.com/login/oauth/authorize?client_id=client-id&scope=gist+repo')
  })

  it('can build the OAuth authorize URL against a mock service', () => {
    const url = buildGitHubOAuthUrl({
      authorizeUrl: 'http://127.0.0.1:9999/login/oauth/authorize',
      clientId: 'client-id',
      scopes: ['gist']
    })

    expect(url).toBe('http://127.0.0.1:9999/login/oauth/authorize?client_id=client-id&scope=gist')
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

  it('keeps OAuth auth windows open for aborted or non-main-frame load failures', () => {
    expect(shouldIgnoreGitHubOAuthLoadFailure({
      errorCode: -3,
      isMainFrame: true
    })).toBe(true)

    expect(shouldIgnoreGitHubOAuthLoadFailure({
      errorDescription: "ERR_ABORTED (-3) loading 'https://github.com/login/oauth/authorize'",
      isMainFrame: true
    })).toBe(true)

    expect(shouldIgnoreGitHubOAuthLoadFailure({
      errorCode: -2,
      isMainFrame: false
    })).toBe(true)

    expect(shouldIgnoreGitHubOAuthLoadFailure({
      errorCode: -2,
      isMainFrame: true
    })).toBe(false)
  })

  it('uses a non-sandboxed OAuth auth window on Windows', () => {
    expect(shouldSandboxGitHubOAuthWindow('win32')).toBe(false)
    expect(shouldSandboxGitHubOAuthWindow('darwin')).toBe(true)
    expect(shouldSandboxGitHubOAuthWindow('linux')).toBe(true)
  })

  it('disables hardware acceleration only for the Windows OAuth rendering workaround', () => {
    expect(shouldDisableGitHubOAuthHardwareAccelerationWorkaround('win32')).toBe(true)
    expect(shouldDisableGitHubOAuthHardwareAccelerationWorkaround('darwin')).toBe(false)
    expect(shouldDisableGitHubOAuthHardwareAccelerationWorkaround('linux')).toBe(false)
  })

  it('disables Chromium renderer code integrity only for the Windows OAuth rendering workaround', () => {
    expect(getGitHubOAuthDisabledChromiumFeaturesWorkaround('win32'))
      .toEqual(['RendererCodeIntegrity'])
    expect(getGitHubOAuthDisabledChromiumFeaturesWorkaround('darwin')).toEqual([])
    expect(getGitHubOAuthDisabledChromiumFeaturesWorkaround('linux')).toEqual([])
  })
})
