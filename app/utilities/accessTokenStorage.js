const LEGACY_TOKEN_KEY = 'token'
const ENCRYPTED_TOKEN_KEY = 'encrypted-token'
const SAFE_STORAGE_PROVIDER = 'electron-safeStorage'
const DEFAULT_STORAGE_MODE = 'auto'
const STORAGE_MODES = new Set(['auto', 'encrypted', 'file'])

function getScopedTokenKeys (scope) {
  if (scope === undefined || scope === null || scope === '') {
    return {
      encrypted: ENCRYPTED_TOKEN_KEY,
      legacy: LEGACY_TOKEN_KEY
    }
  }

  if (typeof scope !== 'string' || !scope.trim() || scope.length > 500 || hasUnsafeScopeCharacter(scope)) {
    throw new Error('Invalid access token storage scope')
  }

  const normalizedScope = encodeURIComponent(scope.trim())
  return {
    encrypted: `${ENCRYPTED_TOKEN_KEY}:${normalizedScope}`,
    legacy: `${LEGACY_TOKEN_KEY}:${normalizedScope}`
  }
}

function hasUnsafeScopeCharacter (scope) {
  return Array.from(scope).some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function createResult (status, data, error) {
  const result = { status, data }
  if (error) result.error = error
  return result
}

function logWarn (logger, message) {
  if (logger && typeof logger.warn === 'function') logger.warn(message)
}

function normalizeStorageMode (mode) {
  return STORAGE_MODES.has(mode) ? mode : DEFAULT_STORAGE_MODE
}

function getConfiguredStorageMode (conf) {
  if (!conf || typeof conf.get !== 'function') return DEFAULT_STORAGE_MODE
  return normalizeStorageMode(conf.get('security:cachedAccessTokenStorage'))
}

function getEffectiveStorageMode ({ conf, isDev }) {
  const configuredMode = getConfiguredStorageMode(conf)
  if (configuredMode !== DEFAULT_STORAGE_MODE) return configuredMode
  return isDev ? 'file' : 'encrypted'
}

function hasTokenValue (value) {
  return typeof value === 'string' && value.length > 0
}

function getSafeStorageUnavailableReason ({ safeStorage, platform }) {
  try {
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function') {
      return 'safeStorage unavailable'
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return 'safeStorage encryption unavailable'
    }

    if (platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
      const backend = safeStorage.getSelectedStorageBackend()
      if (backend === 'basic_text') {
        return 'Linux safeStorage selected the insecure basic_text backend'
      }
    }

    return null
  } catch (error) {
    return `safeStorage availability check failed: ${error.message}`
  }
}

function createAccessTokenStorage ({
  conf,
  getSafeStorage,
  isDev,
  localStorage,
  logger,
  platform = process.platform,
  safeStorage
}) {
  function getMode () {
    return getEffectiveStorageMode({ conf, isDev })
  }

  function resolveSafeStorage () {
    return typeof getSafeStorage === 'function' ? getSafeStorage() : safeStorage
  }

  function ensureEncryptedStorageAvailable () {
    const unavailableReason = getSafeStorageUnavailableReason({
      safeStorage: resolveSafeStorage(),
      platform
    })
    if (unavailableReason) {
      logWarn(logger, `[auth] Encrypted cached access token storage unavailable: ${unavailableReason}`)
    }
    return unavailableReason
  }

  function logFileStorageFallback (unavailableReason) {
    logWarn(logger, `[auth] Falling back to local file for cached access token: ${unavailableReason}`)
  }

  function readFileTokenFallback (unavailableReason, keys) {
    logFileStorageFallback(unavailableReason)
    return localStorage.get(keys.legacy)
  }

  function writeFileTokenFallback (token, unavailableReason, keys) {
    logFileStorageFallback(unavailableReason)

    const legacyWrite = localStorage.set(keys.legacy, token)
    if (!legacyWrite.status) return createResult(false, null, legacyWrite.error)

    const encryptedClear = localStorage.set(keys.encrypted, null)
    return createResult(
      Boolean(encryptedClear.status),
      token,
      encryptedClear.error
    )
  }

  function clearEncryptedToken (keys) {
    const encryptedClear = localStorage.set(keys.encrypted, null)
    const legacyClear = localStorage.set(keys.legacy, null)
    return createResult(Boolean(encryptedClear.status && legacyClear.status), null, encryptedClear.error || legacyClear.error)
  }

  function writeEncryptedToken (token, keys) {
    if (!hasTokenValue(token)) return clearEncryptedToken(keys)

    let encryptedToken
    try {
      encryptedToken = resolveSafeStorage().encryptString(token)
    } catch (error) {
      logWarn(logger, `[auth] Failed to encrypt cached access token: ${error.message}`)
      return createResult(false, null, error)
    }

    const writeResult = localStorage.set(keys.encrypted, {
      version: 1,
      provider: SAFE_STORAGE_PROVIDER,
      data: encryptedToken.toString('base64')
    })

    if (!writeResult.status) return createResult(false, null, writeResult.error)

    const legacyClear = localStorage.set(keys.legacy, null)
    if (!legacyClear.status) {
      logWarn(logger, '[auth] Failed to clear legacy cached access token after encrypted write')
    }

    return createResult(true, token)
  }

  function readEncryptedTokenRecord (record) {
    if (!record || record.version !== 1 ||
      record.provider !== SAFE_STORAGE_PROVIDER ||
      typeof record.data !== 'string') {
      return createResult(false, null, new Error('Invalid encrypted token record'))
    }

    try {
      return createResult(true, resolveSafeStorage().decryptString(Buffer.from(record.data, 'base64')))
    } catch (error) {
      logWarn(logger, `[auth] Failed to decrypt cached access token: ${error.message}`)
      return createResult(false, null, error)
    }
  }

  function getEncryptedToken (keys) {
    const encryptedToken = localStorage.get(keys.encrypted)
    if (encryptedToken.status && encryptedToken.data) {
      const unavailableReason = ensureEncryptedStorageAvailable()
      if (unavailableReason) return readFileTokenFallback(unavailableReason, keys)
      return readEncryptedTokenRecord(encryptedToken.data)
    }

    return localStorage.get(keys.legacy)
  }

  return {
    get (scope) {
      let keys
      try {
        keys = getScopedTokenKeys(scope)
      } catch (error) {
        return createResult(false, null, error)
      }

      if (getMode() === 'file') return localStorage.get(keys.legacy)
      return getEncryptedToken(keys)
    },

    set (token, scope) {
      let keys
      try {
        keys = getScopedTokenKeys(scope)
      } catch (error) {
        return createResult(false, null, error)
      }

      if (!hasTokenValue(token)) return clearEncryptedToken(keys)
      if (getMode() === 'file') return localStorage.set(keys.legacy, token)

      const unavailableReason = ensureEncryptedStorageAvailable()
      if (unavailableReason) return writeFileTokenFallback(token, unavailableReason, keys)
      return writeEncryptedToken(token, keys)
    }
  }
}

module.exports = {
  ENCRYPTED_TOKEN_KEY,
  LEGACY_TOKEN_KEY,
  SAFE_STORAGE_PROVIDER,
  createAccessTokenStorage,
  getScopedTokenKeys,
  getConfiguredStorageMode,
  getEffectiveStorageMode,
  getSafeStorageUnavailableReason
}
