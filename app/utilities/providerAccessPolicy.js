const path = require('path')
const {
  getConfiguredProvider,
  getProviderConfigError,
  getProviderStorageKey
} = require('./snippetProvider')

function createProviderAccessPolicy ({ conf }) {
  function getActiveProviderScope () {
    if (getProviderConfigError(conf)) return null

    try {
      return getProviderStorageKey(getConfiguredProvider(conf))
    } catch {
      return null
    }
  }

  function isActiveProvider (provider) {
    try {
      const activeProviderScope = getActiveProviderScope()
      return Boolean(activeProviderScope) && getProviderStorageKey(provider) === activeProviderScope
    } catch (error) {
      return false
    }
  }

  function canReadCredential (scope) {
    const activeProviderScope = getActiveProviderScope()
    return Boolean(activeProviderScope) && typeof scope === 'string' && scope === activeProviderScope
  }

  function canWriteCredential (token, scope) {
    if ((scope === undefined || scope === null || scope === '') && token === null) {
      return true
    }
    return canReadCredential(scope)
  }

  return {
    canReadCredential,
    canWriteCredential,
    isActiveProvider
  }
}

function isCredentialStorageKey (key) {
  if (typeof key !== 'string') return false
  const storageKey = path.basename(key, '.json').toLowerCase()
  return /^scoped-v1-[a-f0-9]{64}$/.test(storageKey) ||
    storageKey === 'token' ||
    storageKey.startsWith('token:') ||
    storageKey === 'encrypted-token' ||
    storageKey.startsWith('encrypted-token:')
}

module.exports = {
  createProviderAccessPolicy,
  isCredentialStorageKey
}
