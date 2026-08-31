import { describe, expect, it, vi } from 'vitest'

import {
  clearNewGistDraft,
  createNewGistDraft,
  createNewGistWithDraft,
  getNewGistDraftStorageKey,
  loadNewGistDraft,
  saveNewGistDraft
} from '../../app/utilities/newGistDraft'

function createMemoryStorage (initialValues = {}) {
  const values = Object.assign({}, initialValues)

  return {
    values,
    get: vi.fn(key => Object.prototype.hasOwnProperty.call(values, key)
      ? { status: true, data: values[key] }
      : { status: false }),
    set: vi.fn((key, value) => {
      values[key] = value
      return { status: true, data: value }
    })
  }
}

describe('new snippet draft storage', () => {
  it('normalizes editor submissions into restorable initial data', () => {
    expect(createNewGistDraft({
      description: 'network-safe snippet',
      private: true,
      gistFiles: [
        { filename: 'app.js', content: 'console.log(1)', _editorId: 'editor-1' }
      ]
    })).toEqual({
      description: 'network-safe snippet',
      private: true,
      gists: [
        { filename: 'app.js', content: 'console.log(1)' }
      ]
    })
  })

  it('scopes saved drafts to the signed-in user', () => {
    const storage = createMemoryStorage()
    const draft = {
      description: 'octocat draft',
      private: false,
      gistFiles: [{ filename: 'draft.md', content: '# Draft' }]
    }

    expect(saveNewGistDraft(storage, 'octocat', draft).status).toBe(true)
    expect(loadNewGistDraft(storage, 'other-user')).toBeNull()
    expect(loadNewGistDraft(storage, 'octocat')).toEqual({
      description: 'octocat draft',
      private: false,
      gists: [{ filename: 'draft.md', content: '# Draft' }]
    })
  })

  it('clears a draft only after the caller completes creation', () => {
    const storage = createMemoryStorage()
    const key = getNewGistDraftStorageKey('octocat')

    saveNewGistDraft(storage, 'octocat', {
      description: 'saved before request',
      gistFiles: [{ filename: 'draft.txt', content: 'keep me' }]
    })

    expect(storage.values[key]).toEqual(expect.objectContaining({
      description: 'saved before request'
    }))

    expect(clearNewGistDraft(storage, 'octocat').status).toBe(true)
    expect(storage.values[key]).toBeNull()
    expect(loadNewGistDraft(storage, 'octocat')).toBeNull()
  })

  it('retains the local draft when creation fails', async () => {
    const storage = createMemoryStorage()
    const createGist = vi.fn().mockRejectedValue(new Error('offline'))

    const result = await createNewGistWithDraft({
      storage,
      userLogin: 'octocat',
      data: {
        description: 'saved before request',
        gistFiles: [{ filename: 'draft.txt', content: 'keep me' }]
      },
      createGist
    })

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.objectContaining({ message: 'offline' }),
      draftWrite: { status: true }
    })
    expect(loadNewGistDraft(storage, 'octocat')).toEqual({
      description: 'saved before request',
      private: false,
      gists: [{ filename: 'draft.txt', content: 'keep me' }]
    })
  })

  it('returns the created gist while leaving draft cleanup to the success handler', async () => {
    const storage = createMemoryStorage()
    const gistDetails = { id: 'gist-1' }

    const result = await createNewGistWithDraft({
      storage,
      userLogin: 'octocat',
      data: {
        description: 'created draft',
        gistFiles: [{ filename: 'created.txt', content: 'created' }]
      },
      createGist: () => Promise.resolve(gistDetails)
    })

    expect(result).toMatchObject({
      status: 'created',
      gistDetails,
      draftWrite: { status: true }
    })
    expect(loadNewGistDraft(storage, 'octocat')).not.toBeNull()
  })

  it('ignores malformed drafts and reports storage write failures', () => {
    const key = getNewGistDraftStorageKey('octocat')
    const malformedStorage = createMemoryStorage({
      [key]: { description: 'missing files' }
    })
    const failingStorage = {
      set: () => { throw new Error('disk full') }
    }

    expect(loadNewGistDraft(malformedStorage, 'octocat')).toBeNull()
    expect(saveNewGistDraft(failingStorage, 'octocat', {})).toMatchObject({
      status: false,
      error: expect.objectContaining({ message: 'disk full' })
    })
    expect(clearNewGistDraft(failingStorage, 'octocat')).toMatchObject({
      status: false,
      error: expect.objectContaining({ message: 'disk full' })
    })
  })
})
