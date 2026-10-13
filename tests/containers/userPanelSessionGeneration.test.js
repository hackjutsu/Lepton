import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSnippetApi: vi.fn(),
  notifyFailure: vi.fn(),
  notifySuccess: vi.fn(),
  requestCreate: vi.fn(),
  storageGet: vi.fn(),
  storageSet: vi.fn()
}))

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    config: {
      get: () => false
    },
    ipc: {
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      send: vi.fn()
    },
    localStorage: {
      get: mocks.storageGet,
      set: mocks.storageSet
    },
    logger: {
      error: vi.fn(),
      info: vi.fn()
    },
    window: {
      setTitle: vi.fn()
    }
  }
}))

vi.mock('../../app/utilities/snippetApi', () => ({
  CREATE_SINGLE_GIST: 'CREATE_SINGLE_GIST',
  getSnippetApi: mocks.getSnippetApi
}))

vi.mock('../../app/utilities/notifier', () => ({
  notifyFailure: mocks.notifyFailure,
  notifySuccess: mocks.notifySuccess
}))

vi.mock('../../app/containers/gistEditorForm', () => ({
  default: () => null,
  NEW_GIST: 'NEW_GIST'
}))

import ConnectedUserPanel from '../../app/containers/userPanel'
import { advanceSessionGeneration } from '../../app/utilities/sessionGeneration'
import { getNewGistDraftStorageKey } from '../../app/utilities/newGistDraft'

const UserPanel = ConnectedUserPanel.WrappedComponent

describe('UserPanel create session isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSnippetApi.mockReturnValue(mocks.requestCreate)
    mocks.storageGet.mockReturnValue({ status: false })
    mocks.storageSet.mockReturnValue({ status: true })
  })

  it('clears the captured draft but ignores a create success from a stale session', async () => {
    let resolveCreate
    mocks.requestCreate.mockReturnValue(new Promise(resolve => {
      resolveCreate = resolve
    }))

    const oldStorageKey = 'gitlab:https://gitlab.old.test:octo'
    const newStorageKey = 'gitlab:https://gitlab.new.test:octo'
    const props = {
      accessToken: 'old-session-token',
      userSession: {
        activeStatus: 'ACTIVE',
        profile: { login: 'octo', storageKey: oldStorageKey }
      }
    }
    const panel = new UserPanel(props)
    panel.updateGistsStoreWithNewGist = vi.fn()
    panel.closeGistEditorModal = vi.fn()
    panel.setState = vi.fn()

    const pendingCreate = panel.handleCreateSingleGist({
      description: 'created in the old session',
      private: true,
      gistFiles: [{ filename: 'example.js', content: 'const stale = true' }]
    })

    await Promise.resolve()
    expect(mocks.requestCreate).toHaveBeenCalledWith(
      'old-session-token',
      'created in the old session',
      { 'example.js': { content: 'const stale = true' } },
      false
    )

    advanceSessionGeneration()
    panel.props = {
      ...props,
      userSession: {
        activeStatus: 'ACTIVE',
        profile: { login: 'octo', storageKey: newStorageKey }
      }
    }
    resolveCreate({ id: 'stale-gist', files: {} })
    await pendingCreate

    const oldDraftKey = getNewGistDraftStorageKey(oldStorageKey)
    const newDraftKey = getNewGistDraftStorageKey(newStorageKey)
    expect(mocks.storageSet).toHaveBeenCalledWith(oldDraftKey, null)
    expect(mocks.storageSet).not.toHaveBeenCalledWith(newDraftKey, null)
    expect(panel.updateGistsStoreWithNewGist).not.toHaveBeenCalled()
    expect(panel.closeGistEditorModal).not.toHaveBeenCalled()
    expect(panel.setState).not.toHaveBeenCalled()
    expect(mocks.notifySuccess).not.toHaveBeenCalled()
  })

  it('submits a prototype-named file as an own file-map entry', async () => {
    mocks.requestCreate.mockResolvedValue({ id: 'created-gist', files: {} })
    const panel = new UserPanel({
      accessToken: 'token-1',
      userSession: {
        activeStatus: 'ACTIVE',
        profile: { login: 'octo', storageKey: 'gitlab:https://gitlab.example.test:octo' }
      }
    })
    panel.updateGistsStoreWithNewGist = vi.fn()
    panel.closeGistEditorModal = vi.fn()
    panel.setState = vi.fn()

    await panel.handleCreateSingleGist({
      description: 'prototype filename',
      private: true,
      gistFiles: [{ filename: '__proto__', content: 'prototype-safe content' }]
    })

    const submittedFiles = mocks.requestCreate.mock.calls[0][2]
    expect(Object.keys(submittedFiles)).toEqual(['__proto__'])
    expect(Object.prototype.hasOwnProperty.call(submittedFiles, '__proto__')).toBe(true)
    expect(submittedFiles.__proto__).toEqual({ content: 'prototype-safe content' })
  })

  it('indexes a prototype-named custom tag without mutating Redux state', () => {
    const gistTags = { 'lang@All': ['existing-gist'] }
    const updateGistTags = vi.fn()
    const panel = new UserPanel({
      gistTags,
      searchIndex: {
        addToFuseIndex: vi.fn(),
        buildSearchRecord: vi.fn(() => ({ id: 'created-gist' }))
      },
      selectGist: vi.fn(),
      updateGistFilters: vi.fn(),
      updateGistTags,
      updateSingleGist: vi.fn(),
      userSession: {
        activeStatus: 'ACTIVE',
        profile: { login: 'octo', storageKey: 'gitlab:https://gitlab.example.test:octo' }
      }
    })

    panel.updateGistsStoreWithNewGist({
      id: 'created-gist',
      description: '[Prototype] Safe custom tag #tags: __proto__',
      files: {
        'example.js': { filename: 'example.js', language: 'JavaScript' }
      }
    })

    const updatedTags = updateGistTags.mock.calls[0][0]
    expect(Object.getPrototypeOf(updatedTags)).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(updatedTags, '__proto__')).toBe(true)
    expect(updatedTags.__proto__).toEqual(['created-gist'])
    expect(Object.prototype.hasOwnProperty.call(gistTags, '__proto__')).toBe(false)
    expect(gistTags['lang@All']).toEqual(['existing-gist'])
  })
})
