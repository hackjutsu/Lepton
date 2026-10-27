import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  createElectronLocalStorage,
  getStorageFilePath
} = require('../../app/utilities/electronLocalStorage')

let tempRoot

function createStorage () {
  tempRoot = mkdtempSync(join(tmpdir(), 'lepton-local-storage-'))
  return createElectronLocalStorage({
    getUserDataPath: () => tempRoot
  })
}

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true })
  tempRoot = null
})

describe('Electron local storage utility', () => {
  it('stores and reads JSON values using the previous storage path layout', () => {
    const storage = createStorage()
    const profile = { login: 'octocat', avatar_url: 'https://example.test/avatar.png' }

    expect(storage.set('profile', profile)).toEqual({
      status: true,
      data: profile
    })
    expect(storage.get('profile')).toEqual({
      status: true,
      data: profile
    })
    expect(readFileSync(join(tempRoot, 'storage', 'profile.json'), 'utf8')).toBe(JSON.stringify(profile))
  })

  it('keeps key normalization compatible with electron-json-storage-sync', () => {
    const userDataPath = '/tmp/lepton-user-data'

    expect(getStorageFilePath(userDataPath, 'token')).toBe(join(userDataPath, 'storage', 'token.json'))
    expect(getStorageFilePath(userDataPath, 'token.json')).toBe(join(userDataPath, 'storage', 'token.json'))
    expect(getStorageFilePath(userDataPath, 'nested/token')).toBe(join(userDataPath, 'storage', 'token.json'))
    expect(getStorageFilePath(userDataPath, 'token value')).toBe(join(userDataPath, 'storage', 'token%20value.json'))
    expect(getStorageFilePath(userDataPath, 'new-gist-draft-octocat'))
      .toBe(join(userDataPath, 'storage', 'new-gist-draft-octocat.json'))
  })

  it('maps provider-scoped records to fixed, case-stable, collision-resistant paths', () => {
    const userDataPath = '/tmp/lepton-user-data'
    const kinds = ['token', 'encrypted-token', 'profile']

    kinds.forEach(kind => {
      const tenantPath = getStorageFilePath(userDataPath, `${kind}:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Ftenant`)
      const jsonTenantPath = getStorageFilePath(userDataPath, `${kind}:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Ftenant.json`)
      const upperPath = getStorageFilePath(userDataPath, `${kind}:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2FTeam`)
      const lowerPath = getStorageFilePath(userDataPath, `${kind}:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Fteam`)

      expect(tenantPath).not.toBe(jsonTenantPath)
      expect(upperPath.toLowerCase()).not.toBe(lowerPath.toLowerCase())
      expect(tenantPath.split('/').pop()).toMatch(/^scoped-v1-[a-f0-9]{64}\.json$/)
    })

    const longPath = getStorageFilePath(userDataPath, `token:${'a'.repeat(500)}`)
    expect(Buffer.byteLength(longPath.split('/').pop())).toBeLessThan(255)
  })

  it('keeps colliding legacy scope shapes isolated across storage instances', () => {
    const storage = createStorage()
    const keys = [
      'token:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Ftenant',
      'token:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Ftenant.json',
      'profile:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2FTeam',
      'profile:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Fteam',
      'new-gist-draft-gitlab%3Ahttps%3A%2F%2Fgitlab.example%3Aalice',
      'new-gist-draft-gitlab%3Ahttps%3A%2F%2Fgitlab.example%3Aalice.json',
      'new-gist-draft-gitlab%3Ahttps%3A%2F%2Fgitlab.example%2FTeam%3Aalice',
      'new-gist-draft-gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Fteam%3Aalice'
    ]

    keys.forEach((key, index) => expect(storage.set(key, `value-${index}`).status).toBe(true))

    const reopened = createElectronLocalStorage({ getUserDataPath: () => tempRoot })
    keys.forEach((key, index) => expect(reopened.get(key).data).toBe(`value-${index}`))

    expect(reopened.set(keys[0], null).status).toBe(true)
    expect(reopened.get(keys[0]).data).toBeNull()
    expect(reopened.get(keys[1]).data).toBe('value-1')
    expect(reopened.get(keys[4]).data).toBe('value-4')
    expect(reopened.get(keys[5]).data).toBe('value-5')
    expect(reopened.get(keys[6]).data).toBe('value-6')
    expect(reopened.get(keys[7]).data).toBe('value-7')
  })

  it('hashes only provider-scoped drafts and new migration markers', () => {
    const userDataPath = '/tmp/lepton-user-data'
    const scopedDraftKeys = [
      'new-gist-draft-github%3Ahttps%3A%2F%2Fgithub.com%3Aocto',
      'new-gist-draft-gitlab%3Ahttps%3A%2F%2Fgitlab.example%3Aocto',
      'legacy-account-storage-migration-octo'
    ]

    scopedDraftKeys.forEach(key => {
      expect(getStorageFilePath(userDataPath, key).split('/').pop())
        .toMatch(/^scoped-v1-[a-f0-9]{64}\.json$/)
    })

    expect(getStorageFilePath(userDataPath, 'new-gist-draft-octo').split('/').pop())
      .toBe('new-gist-draft-octo.json')
  })

  it('does not reuse ambiguous files from the previous scoped path layout', () => {
    const storage = createStorage()
    const key = 'token:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Ftenant.json'
    const oldFileName = encodeURIComponent('token:gitlab%3Ahttps%3A%2F%2Fgitlab.example%2Ftenant.json')
    const oldPath = join(tempRoot, 'storage', oldFileName)
    mkdirSync(join(tempRoot, 'storage'), { recursive: true })
    writeFileSync(oldPath, JSON.stringify('ambiguous-token'), 'utf8')

    expect(existsSync(oldPath)).toBe(true)
    expect(storage.get(key).status).toBe(false)
  })

  it('returns status false for missing or invalid keys', () => {
    const storage = createStorage()

    expect(storage.get('missing').status).toBe(false)
    expect(storage.get('').status).toBe(false)
    expect(storage.get('  ').status).toBe(false)
    expect(storage.set('', 'token').status).toBe(false)
    expect(storage.set('  ', 'token').status).toBe(false)
  })

  it('returns status false for invalid JSON values', () => {
    const storage = createStorage()
    const circular = {}
    circular.self = circular

    expect(storage.set('token', undefined).status).toBe(false)
    expect(storage.set('token', circular).status).toBe(false)
  })

  it('returns status false when a stored JSON file cannot be parsed', () => {
    const storage = createStorage()
    storage.set('token', 'abc123')
    writeFileSync(join(tempRoot, 'storage', 'token.json'), '{', 'utf8')

    expect(storage.get('token').status).toBe(false)
  })
})
