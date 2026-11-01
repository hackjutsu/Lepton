import { describe, expect, it, vi } from 'vitest'
import { requestProvider, session } from '../../prototypes/tauri/legacy/session'

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
    expect(session).toEqual({ mode: 'local', base: '', token: '' })
  })
})
