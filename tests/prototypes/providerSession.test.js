import { describe, expect, it, vi } from 'vitest'
import { enqueueCache, formatLogArguments, githubStarredUrl, isOfflineError, loadRemoteSnapshot, loadRemoteSnippets, loginFailureStatus, requestProvider, session, unavailableGithubSnippet } from '../../prototypes/tauri/legacy/session'
import githubCore from '../../app/utilities/githubApi/core'

describe('Tauri provider request bridge', () => {
  it('routes edit and delete arguments to the selected provider', async () => {
    const invoke = vi.fn().mockResolvedValue({ id: '42' })
    const state = { mode: 'gitlab', base: 'http://127.0.0.1:8080', token: 'test-only' }
    const patch = { 'a.js': { content: 'hello' } }
    await requestProvider(invoke, 'EDIT_SINGLE_GIST', ['ignored', '42', 'title', patch], state)
    expect(invoke).toHaveBeenCalledWith('gitlab_request', { base: state.base, token: state.token, operation: 'update', args: ['42', 'title', patch], proxy: null })
    await requestProvider(invoke, 'DELETE_SINGLE_GIST', ['ignored', '42'], { ...state, mode: 'github' })
    expect(invoke).toHaveBeenLastCalledWith('github_request', { base: state.base, token: state.token, operation: 'delete', args: ['42'], proxy: null })
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

  it('isolates incomplete snippets without treating unrelated failures as unavailable files', () => {
    const brief = { id: 'abc', files: { 'a.txt': { filename: 'a.txt' } } }
    for (const error of ['GitHub returned an incomplete file list; this snippet cannot be edited safely', 'GitHub raw file exceeds the supported size', 'GitHub raw file is not UTF-8 text']) {
      const result = unavailableGithubSnippet(brief, error)
      expect(result.id).toBe('abc')
      expect(result._leptonUnavailable).toContain('cannot be displayed or edited safely')
    }
    expect(unavailableGithubSnippet(brief, 'GitHub request failed (HTTP 401)')).toBeNull()
    expect(unavailableGithubSnippet(brief, 'GitHub network request failed')).toBeNull()
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

  it('honors downloadAll and reuses only unchanged cached snippets', async () => {
    const list = ['a', 'b', 'c'].map(id => ({ id, updated_at: 'new', files: { 'x.txt': { filename: 'x.txt' } } }))
    const cached = [{ ...list[1], files: { 'x.txt': { content: 'cached' } } }, { ...list[2], updated_at: 'old' }]
    const fetchDetails = vi.fn(async gist => ({ ...gist, files: { 'x.txt': { content: gist.id } } }))
    const lazy = await loadRemoteSnippets(list, fetchDetails, { cached, selectedId: 'a', downloadAll: false, provider: 'github' })
    expect(fetchDetails.mock.calls.map(call => call[0].id)).toEqual(['a'])
    expect(lazy[0].files['x.txt'].content).toBe('a')
    expect(lazy[1].files['x.txt'].content).toBe('cached')
    expect(lazy[2]._leptonBrief).toBe(true)
    fetchDetails.mockClear()
    const all = await loadRemoteSnippets(list, fetchDetails, { cached, downloadAll: true, provider: 'github' })
    expect(fetchDetails.mock.calls.map(call => call[0].id).sort()).toEqual(['a', 'c'])
    expect(all.every(gist => !gist._leptonBrief)).toBe(true)
  })

  it('keeps incomplete GitHub snippets visible when downloading details', async () => {
    const brief = { id: 'bad', files: {} }
    const fetchDetails = vi.fn().mockRejectedValue('GitHub returned an incomplete file list; this snippet cannot be edited safely')
    const result = await loadRemoteSnippets([brief], fetchDetails, { downloadAll: true, provider: 'github' })
    expect(result[0]._leptonUnavailable).toContain('cannot be displayed')
    await expect(loadRemoteSnippets([brief], () => Promise.reject('GitHub network request failed'), { downloadAll: true, provider: 'github' })).rejects.toBe('GitHub network request failed')
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
