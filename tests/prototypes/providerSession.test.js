import { describe, expect, it, vi } from 'vitest'
import { enqueueCache, formatLogArguments, githubStarredUrl, isOfflineError, loadRemoteSnapshot, loginFailureStatus, requestProvider, session } from '../../prototypes/tauri/legacy/session'
import githubCore from '../../app/utilities/githubApi/core'

describe('Tauri provider request bridge', () => {
  it('routes edit and delete arguments to the selected provider', async () => {
    const invoke = vi.fn().mockResolvedValue({ id: '42' })
    const state = { mode: 'gitlab', base: 'http://127.0.0.1:8080', token: 'test-only' }
    const patch = { 'a.js': { content: 'hello' } }
    await requestProvider(invoke, 'EDIT_SINGLE_GIST', ['ignored', '42', 'title', patch], state)
    expect(invoke).toHaveBeenCalledWith('gitlab_request', { base: state.base, token: state.token, operation: 'update', args: ['42', 'title', patch] })
    await requestProvider(invoke, 'DELETE_SINGLE_GIST', ['ignored', '42'], { ...state, mode: 'github' })
    expect(invoke).toHaveBeenLastCalledWith('github_request', { base: state.base, token: state.token, operation: 'delete', args: ['42'] })
  })

  it('rejects unsupported operations without invoking a backend', async () => {
    const invoke = vi.fn()
    await expect(requestProvider(invoke, 'EXCHANGE_ACCESS_TOKEN', [])).rejects.toThrow('Unsupported')
    expect(invoke).not.toHaveBeenCalled()
    expect(session).toEqual({ mode: 'local', base: '', token: '', account: null, revision: 0 })
  })

  it('uses the original GitHub starred-Gist link for cloud and enterprise accounts', () => {
    for (const base of ['https://github.com', 'https://github.example.test:8443']) {
      const profile = githubCore.normalizeGitHubProfile({ login: 'some user' }, { type: 'github', baseUrl: base })
      expect(githubStarredUrl(base, 'some user')).toBe(profile.starred_url)
    }
    expect(githubStarredUrl('https://github.com', null)).toBeNull()
  })

  it('matches Electron login messages for rejected tokens and other failures', () => {
    expect(loginFailureStatus('GitHub request failed (HTTP 401)', '/tmp/lepton.log')).toEqual({ level: 'error', message: 'Token invalid. Please try again.', logFilePath: null })
    expect(loginFailureStatus('GitHub request failed (HTTP 503)', '/tmp/lepton.log')).toEqual({ level: 'error', message: 'Sign-in failed.', logFilePath: '/tmp/lepton.log' })
  })

  it('redacts structured secrets, known token patterns and the active session token', () => {
    const result = formatLogArguments(['failure with custom-secret', { token: 'private', message: 'ghp_example123' }], 'custom-secret')
    expect(result).not.toContain('custom-secret')
    expect(result).not.toContain('private')
    expect(result).not.toContain('ghp_example123')
    expect(result).toContain('[REDACTED]')
  })

  it('uses an offline cache only for transport failures, not authorization or data errors', () => {
    expect(isOfflineError('GitHub network request failed')).toBe(true)
    expect(isOfflineError('GitLab network request failed')).toBe(true)
    expect(isOfflineError('GitHub request failed (HTTP 401)')).toBe(false)
    expect(isOfflineError('GitHub returned an incomplete file list')).toBe(false)
  })

  it('loads only the matching account cache after a network failure', async () => {
    const account = { provider: 'github', base: 'https://github.com', login: 'octocat' }
    const target = { mode: 'github', base: account.base }
    const loadCache = vi.fn().mockResolvedValue({ profile: { login: 'octocat' }, snippets: [], syncedAt: 'time' })
    const offline = () => Promise.reject('GitHub network request failed')
    expect(await loadRemoteSnapshot(account, target, offline, loadCache)).toEqual({ account: { login: 'octocat' }, snippets: [], offline: true, syncedAt: 'time' })
    await expect(loadRemoteSnapshot(account, target, () => Promise.reject('GitHub request failed (HTTP 401)'), loadCache)).rejects.toBe('GitHub request failed (HTTP 401)')
    await expect(loadRemoteSnapshot(account, { ...target, base: 'https://other.test' }, offline, loadCache)).rejects.toBe('GitHub network request failed')
    expect(loadCache).toHaveBeenCalledTimes(1)
  })

  it('serializes cache updates and continues after a failed write', async () => {
    const events = []
    const first = enqueueCache(async () => { events.push('first'); throw new Error('failed') })
    const second = enqueueCache(async () => { events.push('second') })
    await expect(first).rejects.toThrow('failed')
    await second
    expect(events).toEqual(['first', 'second'])
  })

  it('does not report an online save as failed if updating the cache fails', async () => {
    const account = { provider: 'github', base: 'https://github.com', login: 'test' }
    const gist = { id: 'abc', files: { 'a.txt': { content: 'saved' } } }
    Object.assign(session, { mode: 'github', base: account.base, token: 'test-only', account, revision: 0 })
    const invoke = vi.fn((command) => command === 'github_request' ? Promise.resolve(gist) : Promise.reject(new Error('cache unavailable')))
    try {
      await expect(requestProvider(invoke, 'EDIT_SINGLE_GIST', ['unused', 'abc', 'title', {}])).resolves.toEqual(gist)
      expect(session.revision).toBe(1)
      expect(invoke).toHaveBeenCalledWith('update_remote_cache', { account, gist })
    } finally { Object.assign(session, { mode: 'local', base: '', token: '', account: null, revision: 0 }) }
  })
})
