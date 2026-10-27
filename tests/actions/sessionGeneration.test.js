import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildSearchRecord: vi.fn(),
  getSnippetApi: vi.fn(),
  notifyFailure: vi.fn(),
  requestSingleGist: vi.fn(),
  updateFuseIndex: vi.fn()
}))

vi.mock('../../app/utilities/snippetApi', () => ({
  GET_SINGLE_GIST: 'GET_SINGLE_GIST',
  getSnippetApi: mocks.getSnippetApi
}))

vi.mock('../../app/utilities/notifier', () => ({
  notifyFailure: mocks.notifyFailure
}))

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    logger: {
      error: vi.fn()
    }
  }
}))

vi.mock('../../app/utilities/search', () => ({
  default: {
    buildSearchRecord: mocks.buildSearchRecord,
    updateFuseIndex: mocks.updateFuseIndex
  }
}))

vi.mock('../../app/utilities/i18n', () => ({
  t: (key) => key
}))

import { fetchSingleGist } from '../../app/actions'
import { advanceSessionGeneration } from '../../app/utilities/sessionGeneration'

describe('async action session isolation', () => {
  beforeEach(() => {
    mocks.getSnippetApi.mockReturnValue(mocks.requestSingleGist)
  })

  it('does not commit a deferred gist response after logout or provider change', async () => {
    let resolveRequest
    mocks.requestSingleGist.mockReturnValue(new Promise(resolve => {
      resolveRequest = resolve
    }))
    const dispatch = vi.fn()
    const oldGist = {
      brief: { id: 'gist-1', description: 'old' }
    }

    const pendingRequest = fetchSingleGist(oldGist, 'gist-1')(
      dispatch,
      () => ({ accessToken: 'old-session-token' })
    )

    expect(mocks.requestSingleGist).toHaveBeenCalledWith('old-session-token', 'gist-1')

    advanceSessionGeneration()
    resolveRequest({ id: 'gist-1', description: 'stale response' })
    await pendingRequest

    expect(dispatch).not.toHaveBeenCalled()
    expect(mocks.buildSearchRecord).not.toHaveBeenCalled()
    expect(mocks.updateFuseIndex).not.toHaveBeenCalled()
  })
})
