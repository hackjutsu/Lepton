import { afterEach, describe, expect, it, vi } from 'vitest'
import liveCheck from './gitlab-api-live'

const { verifyGitLabApi } = liveCheck
const baseUrl = 'https://gitlab.test.invalid'
const profile = { username: 'test-user', web_url: `${baseUrl}/test-user` }
const snippet = {
  id: 42,
  title: 'Test',
  visibility: 'private',
  author: profile,
  files: []
}
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
})

afterEach(() => vi.unstubAllGlobals())

describe('live GitLab verification cleanup', () => {
  it('does not make any requests without a test credential', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(verifyGitLabApi({ baseUrl })).rejects.toThrow('test credential')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['assertion', 'http'])('deletes only its new snippet after an %s failure', async failure => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(profile))
      .mockResolvedValueOnce(response({ ...snippet, visibility: failure === 'assertion' ? 'public' : 'private' }))
    if (failure === 'http') fetch.mockResolvedValueOnce(response({ message: 'Unavailable' }, 503))
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)

    await expect(verifyGitLabApi({ baseUrl, token: 'test-only', log: () => {} })).rejects.toThrow()
    const deletes = fetch.mock.calls.filter(([, options]) => options.method === 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toBe(`${baseUrl}/api/v4/snippets/42`)
  })
})
