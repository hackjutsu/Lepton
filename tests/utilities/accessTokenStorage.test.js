import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const defaultConfig = require('../../configs/defaultConfig')
const {
  ENCRYPTED_TOKEN_KEY,
  LEGACY_TOKEN_KEY,
  SAFE_STORAGE_PROVIDER,
  createAccessTokenStorage,
  getConfiguredStorageMode,
  getEffectiveStorageMode
} = require('../../app/utilities/accessTokenStorage')
const { createElectronLocalStorage } = require('../../app/utilities/electronLocalStorage')

function createConf (values = {}) {
  return {
    get: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined
  }
}

function createMemoryStorage (initialValues = {}) {
  const values = { ...initialValues }
  return {
    values,
    get: vi.fn((key) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) {
        return { status: false, data: null }
      }
      return { status: true, data: values[key] }
    }),
    set: vi.fn((key, value) => {
      values[key] = value
      return { status: true, data: value }
    })
  }
}

function createSafeStorage (options = {}) {
  const {
    available = true,
    backend = 'gnome_libsecret'
  } = options

  return {
    isEncryptionAvailable: vi.fn(() => available),
    getSelectedStorageBackend: vi.fn(() => backend),
    encryptString: vi.fn((value) => Buffer.from(`encrypted:${value}`, 'utf8')),
    decryptString: vi.fn((encrypted) => encrypted.toString('utf8').replace(/^encrypted:/, ''))
  }
}

function createLogger () {
  return {
    warn: vi.fn()
  }
}

describe('access token storage', () => {
  it('defaults cached token storage to auto', () => {
    expect(defaultConfig.security.cachedAccessTokenStorage).toBe('auto')
  })

  it('resolves auto mode to file storage in development and encrypted storage in packaged builds', () => {
    expect(getConfiguredStorageMode(createConf())).toBe('auto')
    expect(getConfiguredStorageMode(createConf({
      'security:cachedAccessTokenStorage': 'invalid'
    }))).toBe('auto')
    expect(getEffectiveStorageMode({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'auto' }),
      isDev: true
    })).toBe('file')
    expect(getEffectiveStorageMode({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'auto' }),
      isDev: false
    })).toBe('encrypted')
  })

  it('preserves legacy file storage when effective mode is file', () => {
    const localStorage = createMemoryStorage()
    const safeStorage = createSafeStorage()
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'auto' }),
      isDev: true,
      localStorage,
      safeStorage
    })

    expect(accessTokenStorage.set('token-1')).toEqual({
      status: true,
      data: 'token-1'
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBe('token-1')
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toBeUndefined()
    expect(safeStorage.encryptString).not.toHaveBeenCalled()
    expect(accessTokenStorage.get()).toEqual({
      status: true,
      data: 'token-1'
    })
  })

  it('encrypts cached token storage when effective mode is encrypted', () => {
    const localStorage = createMemoryStorage()
    const safeStorage = createSafeStorage()
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: true,
      localStorage,
      safeStorage
    })

    expect(accessTokenStorage.set('token-1')).toEqual({
      status: true,
      data: 'token-1'
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBeNull()
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toEqual({
      version: 1,
      provider: SAFE_STORAGE_PROVIDER,
      data: Buffer.from('encrypted:token-1', 'utf8').toString('base64')
    })
    expect(accessTokenStorage.get()).toEqual({
      status: true,
      data: 'token-1'
    })
  })

  it('does not resolve safeStorage when encrypted mode has no cached token', () => {
    const localStorage = createMemoryStorage()
    const getSafeStorage = vi.fn(() => createSafeStorage())
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      getSafeStorage,
      isDev: false,
      localStorage
    })

    expect(accessTokenStorage.get().status).toBe(false)
    expect(getSafeStorage).not.toHaveBeenCalled()
  })

  it('reads a legacy plaintext cached token without relocating it', () => {
    const localStorage = createMemoryStorage({
      [LEGACY_TOKEN_KEY]: 'legacy-token'
    })
    const safeStorage = createSafeStorage()
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: false,
      localStorage,
      safeStorage
    })

    expect(accessTokenStorage.get()).toEqual({
      status: true,
      data: 'legacy-token'
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBe('legacy-token')
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toBeUndefined()
    expect(safeStorage.encryptString).not.toHaveBeenCalled()
  })

  it('reads the file token without probing safeStorage when no encrypted token exists', () => {
    const localStorage = createMemoryStorage({
      [LEGACY_TOKEN_KEY]: 'legacy-token'
    })
    const safeStorage = createSafeStorage({ available: false })
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: false,
      localStorage,
      safeStorage
    })

    expect(accessTokenStorage.get()).toEqual({
      status: true,
      data: 'legacy-token'
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBe('legacy-token')
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toBeUndefined()
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
  })

  it('falls back to the legacy file on Linux when safeStorage selects basic_text', () => {
    const localStorage = createMemoryStorage()
    const logger = createLogger()
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: false,
      localStorage,
      logger,
      platform: 'linux',
      safeStorage: createSafeStorage({ backend: 'basic_text' })
    })

    expect(accessTokenStorage.set('token-1')).toEqual({
      status: true,
      data: 'token-1'
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBe('token-1')
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      '[auth] Encrypted cached access token storage unavailable: Linux safeStorage selected the insecure basic_text backend'
    )
    expect(logger.warn).toHaveBeenCalledWith(
      '[auth] Falling back to local file for cached access token: Linux safeStorage selected the insecure basic_text backend'
    )
  })

  it('replaces an unreadable encrypted token with the local file fallback', () => {
    const localStorage = createMemoryStorage({
      [ENCRYPTED_TOKEN_KEY]: {
        version: 1,
        provider: SAFE_STORAGE_PROVIDER,
        data: Buffer.from('encrypted:stale-token', 'utf8').toString('base64')
      }
    })
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: false,
      localStorage,
      safeStorage: createSafeStorage({ available: false })
    })

    expect(accessTokenStorage.get().status).toBe(false)
    expect(accessTokenStorage.set('current-token')).toEqual({
      status: true,
      data: 'current-token'
    })
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toBeNull()
    expect(accessTokenStorage.get()).toEqual({
      status: true,
      data: 'current-token'
    })
  })

  it('preserves the encrypted token when the fallback file write fails', () => {
    const encryptedRecord = {
      version: 1,
      provider: SAFE_STORAGE_PROVIDER,
      data: Buffer.from('encrypted:stale-token', 'utf8').toString('base64')
    }
    const localStorage = createMemoryStorage({
      [ENCRYPTED_TOKEN_KEY]: encryptedRecord
    })
    const writeError = new Error('fallback write failed')
    localStorage.set.mockImplementation((key, value) => {
      if (key === LEGACY_TOKEN_KEY) {
        return { status: false, data: null, error: writeError }
      }
      localStorage.values[key] = value
      return { status: true, data: value }
    })
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: false,
      localStorage,
      safeStorage: createSafeStorage({ available: false })
    })

    expect(accessTokenStorage.set('current-token')).toEqual({
      status: false,
      data: null,
      error: writeError
    })
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toEqual(encryptedRecord)
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBeUndefined()
    expect(localStorage.set).toHaveBeenCalledTimes(1)
    expect(localStorage.set).toHaveBeenCalledWith(LEGACY_TOKEN_KEY, 'current-token')
  })

  it('relocates a fallback token only when the token is updated', () => {
    const localStorage = createMemoryStorage()
    const safeStorage = createSafeStorage({ available: false })
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: false,
      localStorage,
      safeStorage
    })

    expect(accessTokenStorage.set('token-1').status).toBe(true)
    safeStorage.isEncryptionAvailable.mockReturnValue(true)

    expect(accessTokenStorage.get()).toEqual({
      status: true,
      data: 'token-1'
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBe('token-1')
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toBeNull()
    expect(safeStorage.encryptString).not.toHaveBeenCalled()

    expect(accessTokenStorage.set('token-2')).toEqual({
      status: true,
      data: 'token-2'
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBeNull()
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toEqual({
      version: 1,
      provider: SAFE_STORAGE_PROVIDER,
      data: Buffer.from('encrypted:token-2', 'utf8').toString('base64')
    })
  })

  it('persists the fallback token in the original local storage file across restarts', () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'lepton-token-fallback-'))

    try {
      const localStorage = createElectronLocalStorage({
        getUserDataPath: () => userDataPath
      })
      const storageOptions = {
        conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
        isDev: false,
        localStorage,
        safeStorage: createSafeStorage({ available: false })
      }

      expect(createAccessTokenStorage(storageOptions).set('token-1').status).toBe(true)
      expect(readFileSync(join(userDataPath, 'storage', 'token.json'), 'utf8')).toBe(JSON.stringify('token-1'))
      expect(createAccessTokenStorage(storageOptions).get()).toEqual({
        status: true,
        data: 'token-1'
      })
    } finally {
      rmSync(userDataPath, { recursive: true, force: true })
    }
  })

  it('clears encrypted and legacy cached tokens on logout', () => {
    const localStorage = createMemoryStorage({
      [LEGACY_TOKEN_KEY]: 'legacy-token',
      [ENCRYPTED_TOKEN_KEY]: {
        version: 1,
        provider: SAFE_STORAGE_PROVIDER,
        data: Buffer.from('encrypted:token-1', 'utf8').toString('base64')
      }
    })
    const accessTokenStorage = createAccessTokenStorage({
      conf: createConf({ 'security:cachedAccessTokenStorage': 'encrypted' }),
      isDev: false,
      localStorage,
      safeStorage: createSafeStorage()
    })

    expect(accessTokenStorage.set(null)).toEqual({
      status: true,
      data: null
    })
    expect(localStorage.values[LEGACY_TOKEN_KEY]).toBeNull()
    expect(localStorage.values[ENCRYPTED_TOKEN_KEY]).toBeNull()
  })
})
