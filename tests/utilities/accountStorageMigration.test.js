import { describe, expect, it, vi } from 'vitest'
import { migrateLegacyGitHubAccountStorage } from '../../app/utilities/accountStorageMigration'
import { getNewGistDraftStorageKey } from '../../app/utilities/newGistDraft'

function createPreferences (initialValues = {}) {
  const values = { ...initialValues }
  return {
    values,
    get: vi.fn(key => values[key]),
    set: vi.fn((key, value) => {
      values[key] = value
    })
  }
}

function createStorage (initialValues = {}) {
  const values = { ...initialValues }
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

const provider = { type: 'github', baseUrl: 'https://github.com' }
const login = 'octo'
const accountKey = 'github:https://github.com:octo'

describe('legacy GitHub account storage migration', () => {
  it('copies legacy preferences but leaves ambiguous draft contents untouched', () => {
    const preferences = createPreferences({
      [login]: { pinnedTags: ['JavaScript'] }
    })
    const draft = {
      description: 'unfinished',
      private: true,
      createdAt: '2026-10-12T00:00:00.000Z',
      gists: [{ filename: 'draft.js', content: 'const draft = true' }]
    }
    const storage = createStorage({
      [getNewGistDraftStorageKey(login)]: draft
    })

    migrateLegacyGitHubAccountStorage({
      provider,
      login,
      accountKey,
      localPref: preferences,
      localStorage: storage
    })

    expect(preferences.values[accountKey]).toEqual({ pinnedTags: ['JavaScript'] })
    expect(storage.values[getNewGistDraftStorageKey(accountKey)]).toBeUndefined()
    expect(storage.values[getNewGistDraftStorageKey(login)]).toEqual(draft)
  })

  it('does not overwrite provider-scoped data', () => {
    const preferences = createPreferences({
      [login]: { pinnedTags: ['Legacy'] },
      [accountKey]: { pinnedTags: ['Current'] }
    })
    const currentDraft = { description: 'current' }
    const storage = createStorage({
      [getNewGistDraftStorageKey(login)]: { description: 'legacy' },
      [getNewGistDraftStorageKey(accountKey)]: currentDraft
    })

    migrateLegacyGitHubAccountStorage({
      provider,
      login,
      accountKey,
      localPref: preferences,
      localStorage: storage
    })

    expect(preferences.values[accountKey]).toEqual({ pinnedTags: ['Current'] })
    expect(storage.values[getNewGistDraftStorageKey(accountKey)]).toBe(currentDraft)
  })

  it('migrates legacy preferences into the first authenticated GitHub Enterprise account', () => {
    const enterpriseAccountKey = 'github:https://ghe.example.test:octo'
    const preferences = createPreferences({
      [login]: { pinnedTags: ['Legacy'] }
    })
    const storage = createStorage({
      [getNewGistDraftStorageKey(login)]: { description: 'legacy' }
    })

    migrateLegacyGitHubAccountStorage({
      provider: { type: 'github', baseUrl: 'https://ghe.example.test' },
      login,
      accountKey: enterpriseAccountKey,
      localPref: preferences,
      localStorage: storage
    })

    expect(preferences.values[enterpriseAccountKey]).toEqual({ pinnedTags: ['Legacy'] })
    expect(storage.values[getNewGistDraftStorageKey(enterpriseAccountKey)]).toBeUndefined()
  })

  it('never copies claimed legacy data into a second GitHub host', () => {
    const firstAccountKey = 'github:https://ghe.example.test:octo'
    const secondAccountKey = 'github:https://github.com:octo'
    const preferences = createPreferences({
      [login]: { pinnedTags: ['Enterprise'] },
      Octo: { pinnedTags: ['Wrong host'] }
    })
    const storage = createStorage({
      [getNewGistDraftStorageKey(login)]: { description: 'enterprise draft' },
      [getNewGistDraftStorageKey('Octo')]: { description: 'wrong host draft' }
    })

    migrateLegacyGitHubAccountStorage({
      provider: { type: 'github', baseUrl: 'https://ghe.example.test' },
      login,
      accountKey: firstAccountKey,
      localPref: preferences,
      localStorage: storage
    })
    migrateLegacyGitHubAccountStorage({
      provider,
      login: 'Octo',
      accountKey: secondAccountKey,
      localPref: preferences,
      localStorage: storage
    })

    expect(preferences.values[secondAccountKey]).toBeUndefined()
    expect(storage.values[getNewGistDraftStorageKey(secondAccountKey)]).toBeUndefined()
  })

  it('does not copy GitHub legacy data into GitLab accounts', () => {
    const preferences = createPreferences({
      [login]: { pinnedTags: ['Legacy'] }
    })
    const storage = createStorage({
      [getNewGistDraftStorageKey(login)]: { description: 'legacy' }
    })

    migrateLegacyGitHubAccountStorage({
      provider: { type: 'gitlab', baseUrl: 'https://gitlab.com' },
      login,
      accountKey,
      localPref: preferences,
      localStorage: storage
    })

    expect(preferences.values[accountKey]).toBeUndefined()
    expect(storage.values[getNewGistDraftStorageKey(accountKey)]).toBeUndefined()
  })
})
