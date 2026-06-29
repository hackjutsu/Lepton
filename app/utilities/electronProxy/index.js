function getConfigValue (conf, key) {
  if (!conf || typeof conf.get !== 'function') return undefined
  return conf.get(key)
}

function normalizeElectronProxyRules (proxyRules) {
  if (typeof proxyRules !== 'string') return ''

  const trimmedRules = proxyRules.trim()
  if (!trimmedRules) return ''

  if (trimmedRules.indexOf('=') !== -1 || trimmedRules.indexOf(';') !== -1 || trimmedRules.indexOf(',') !== -1) {
    return trimmedRules
  }

  if (trimmedRules.indexOf('socks://') === 0) {
    return `socks5://${trimmedRules.substring('socks://'.length)}`
  }

  return trimmedRules
}

function createElectronProxyConfig (conf) {
  if (!getConfigValue(conf, 'proxy:enable')) return null

  const proxyAddress = getConfigValue(conf, 'proxy:address')
  if (typeof proxyAddress !== 'string') return null

  const proxyRules = proxyAddress.trim()
  if (!proxyRules) return null

  if (proxyRules.indexOf('pac+') === 0) {
    return {
      mode: 'pac_script',
      pacScript: proxyRules.substring('pac+'.length)
    }
  }

  return {
    mode: 'fixed_servers',
    proxyRules: normalizeElectronProxyRules(proxyRules),
    proxyBypassRules: '<local>'
  }
}

function applyElectronProxy ({ session, conf, logger = console }) {
  const proxyConfig = createElectronProxyConfig(conf)
  if (!proxyConfig) return Promise.resolve(false)

  if (!session || !session.defaultSession || typeof session.defaultSession.setProxy !== 'function') {
    logger.warn('[proxy] Electron session proxy API is unavailable')
    return Promise.resolve(false)
  }

  return session.defaultSession.setProxy(proxyConfig)
    .then(() => {
      logger.info('[proxy] Electron session proxy enabled')
      return true
    })
    .catch(error => {
      const message = error && error.message ? error.message : error
      logger.warn('[proxy] Failed to apply Electron session proxy: ' + message)
      return false
    })
}

module.exports = {
  applyElectronProxy,
  createElectronProxyConfig,
  normalizeElectronProxyRules
}
