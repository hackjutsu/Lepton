const LEGACY_TOKEN_KEY = 'token'
const ENCRYPTED_TOKEN_KEY = 'encrypted-token'
const SAFE_STORAGE_PROVIDER = 'electron-safeStorage'
const DEFAULT_STORAGE_MODE = 'auto'
const STORAGE_MODES = new Set(['auto', 'encrypted', 'file'])

function createResult (status, data, error) {
  const result = { status, data }
  if (error) result.error = error
  return result
}

function logWarn (logger, message) {
  if (logger && typeof logger.warn === 'function') logger.warn(message)
}

function logInfo (logger, message) {
  if (logger && typeof logger.info === 'function') logger.info(message)
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

  function clearEncryptedToken () {
    const encryptedClear = localStorage.set(ENCRYPTED_TOKEN_KEY, null)
    const legacyClear = localStorage.set(LEGACY_TOKEN_KEY, null)
    return createResult(Boolean(encryptedClear.status && legacyClear.status), null, encryptedClear.error || legacyClear.error)
  }

  function writeEncryptedToken (token) {
    if (!hasTokenValue(token)) return clearEncryptedToken()

    const unavailableReason = ensureEncryptedStorageAvailable()
    if (unavailableReason) return createResult(false, null, new Error(unavailableReason))

    let encryptedToken
    try {
      encryptedToken = resolveSafeStorage().encryptString(token)
    } catch (error) {
      logWarn(logger, `[auth] Failed to encrypt cached access token: ${error.message}`)
      return createResult(false, null, error)
    }

    const writeResult = localStorage.set(ENCRYPTED_TOKEN_KEY, {
      version: 1,
      provider: SAFE_STORAGE_PROVIDER,
      data: encryptedToken.toString('base64')
    })

    if (!writeResult.status) return createResult(false, null, writeResult.error)

    const legacyClear = localStorage.set(LEGACY_TOKEN_KEY, null)
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

  function migrateLegacyToken () {
    const legacyToken = localStorage.get(LEGACY_TOKEN_KEY)
    if (!legacyToken.status || !hasTokenValue(legacyToken.data)) {
      return createResult(false, null, legacyToken.error)
    }

    const encryptedWrite = writeEncryptedToken(legacyToken.data)
    if (!encryptedWrite.status) return encryptedWrite

    logInfo(logger, '[auth] Migrated cached access token to encrypted storage')
    return createResult(true, legacyToken.data)
  }

  function getEncryptedToken () {
    const encryptedToken = localStorage.get(ENCRYPTED_TOKEN_KEY)
    if (encryptedToken.status && encryptedToken.data) {
      const unavailableReason = ensureEncryptedStorageAvailable()
      if (unavailableReason) return createResult(false, null, new Error(unavailableReason))
      return readEncryptedTokenRecord(encryptedToken.data)
    }

    return migrateLegacyToken()
  }

  return {
    get () {
      if (getMode() === 'file') return localStorage.get(LEGACY_TOKEN_KEY)
      return getEncryptedToken()
    },

    set (token) {
      if (!hasTokenValue(token)) return clearEncryptedToken()
      if (getMode() === 'file') return localStorage.set(LEGACY_TOKEN_KEY, token)
      return writeEncryptedToken(token)
    }
  }
}

module.exports = {
  ENCRYPTED_TOKEN_KEY,
  LEGACY_TOKEN_KEY,
  SAFE_STORAGE_PROVIDER,
  createAccessTokenStorage,
  getConfiguredStorageMode,
  getEffectiveStorageMode,
  getSafeStorageUnavailableReason
}
