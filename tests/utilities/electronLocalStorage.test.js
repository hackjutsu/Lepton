import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
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
