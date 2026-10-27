const DEFAULT_PROVIDER_TYPE = 'github'
const DEFAULT_PROVIDER_BASE_URLS = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com'
}
const SUPPORTED_PROVIDER_TYPES = new Set(Object.keys(DEFAULT_PROVIDER_BASE_URLS))

function normalizeProviderConfig (input) {
  const source = typeof input === 'string'
    ? { type: input }
    : (input || {})
  const type = normalizeProviderType(firstDefinedValue(
    source.type,
    source.providerType,
    source.provider,
    DEFAULT_PROVIDER_TYPE
  ))
  const baseUrl = normalizeProviderBaseUrl(type, firstDefinedValue(
    source.baseUrl,
    source.url,
    source.host,
    DEFAULT_PROVIDER_BASE_URLS[type]
  ))

  return { type, baseUrl }
}

function getConfiguredProvider (conf) {
  if (!conf || typeof conf.get !== 'function') {
    return normalizeProviderConfig()
  }

  let configuredProvider
  try {
    configuredProvider = getConfiguredProviderInput(conf)
  } catch {
    let configuredType = DEFAULT_PROVIDER_TYPE
    try {
      configuredType = getConfiguredProviderType(conf)
    } catch {
      // Keep the default only when configuration cannot be read at all.
    }
    return { type: configuredType, baseUrl: '' }
  }

  try {
    return normalizeProviderConfig(configuredProvider)
  } catch {
    // Preserve the invalid configured value so every later normalization fails
    // closed instead of silently redirecting credentials to a provider default.
    return {
      type: configuredProvider.type,
      baseUrl: String(configuredProvider.baseUrl || '').trim()
    }
  }
}

function getProviderConfigError (conf) {
  if (!conf || typeof conf.get !== 'function') return null

  let configuredProvider
  try {
    configuredProvider = getConfiguredProviderInput(conf)
  } catch {
    return 'Select a supported snippet provider in Settings.'
  }

  if (configuredProvider.type === 'github') {
    const enterpriseConfigError = getGitHubEnterpriseConfigError(conf)
    if (enterpriseConfigError) return enterpriseConfigError

    try {
      normalizeProviderConfig(configuredProvider)
      return null
    } catch {
      return 'Enter a valid HTTP or HTTPS GitHub instance.'
    }
  }

  if (configuredProvider.type === 'gitlab') {
    try {
      normalizeProviderConfig(configuredProvider)
      return null
    } catch {
      return 'Enter a valid HTTP or HTTPS GitLab instance.'
    }
  }

  return null
}

function getProviderStorageKey (provider) {
  const normalizedProvider = normalizeProviderConfig(provider)
  return `${normalizedProvider.type}:${normalizedProvider.baseUrl}`
}

function isDefaultGitHubProvider (provider) {
  const normalizedProvider = normalizeProviderConfig(provider)
  return normalizedProvider.type === 'github' &&
    normalizedProvider.baseUrl === DEFAULT_PROVIDER_BASE_URLS.github
}

function getGitHubEnterpriseConfigError (conf) {
  if (!conf || typeof conf.get !== 'function') {
    return null
  }

  try {
    assertConfigContainer(conf, 'enterprise')
  } catch {
    return 'Enter a valid GitHub Enterprise configuration in Settings.'
  }

  if (!conf.get('enterprise:enable')) return null

  const host = conf.get('enterprise:host')
  if (typeof host !== 'string' || !host.trim()) {
    return 'Enter a valid GitHub Enterprise host in Settings.'
  }

  try {
    normalizeProviderConfig({ type: 'github', baseUrl: host })
    return null
  } catch {
    return 'Enter a valid GitHub Enterprise host in Settings.'
  }
}

function getAccountStorageKey (provider, login) {
  const providerStorageKey = getProviderStorageKey(provider)
  const normalizedLogin = typeof login === 'string' ? login.trim().toLowerCase() : ''

  return normalizedLogin
    ? `${providerStorageKey}:${normalizedLogin}`
    : providerStorageKey
}

function normalizeProviderType (type) {
  const value = type === undefined ? DEFAULT_PROVIDER_TYPE : type
  const normalizedType = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!SUPPORTED_PROVIDER_TYPES.has(normalizedType)) {
    throw new Error(`Unsupported snippet provider: ${normalizedType}`)
  }
  return normalizedType
}

function normalizeProviderBaseUrl (type, baseUrl) {
  const rawValue = baseUrl === undefined ? DEFAULT_PROVIDER_BASE_URLS[type] : baseUrl
  let value = String(rawValue === null ? '' : rawValue).trim()
  if (!value) throw new Error(`Invalid ${type} provider URL: ${value}`)
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`

  let parsedUrl
  try {
    parsedUrl = new URL(value)
  } catch (error) {
    throw new Error(`Invalid ${type} provider URL: ${value}`)
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    throw new Error(`Unsupported ${type} provider URL protocol: ${parsedUrl.protocol}`)
  }

  parsedUrl.username = ''
  parsedUrl.password = ''
  parsedUrl.search = ''
  parsedUrl.hash = ''
  parsedUrl.pathname = normalizeProviderPath(type, parsedUrl.pathname)

  return parsedUrl.toString().replace(/\/+$/, '')
}

function normalizeProviderPath (type, pathname) {
  let normalizedPath = String(pathname || '').replace(/\/+$/, '')
  const apiSuffix = type === 'gitlab' ? /\/api\/v4$/i : /\/api\/v3$/i
  normalizedPath = normalizedPath.replace(apiSuffix, '')
  return normalizedPath || '/'
}

function getConfiguredProviderInput (conf) {
  const providerConfig = conf.get('provider')
  const configuredType = getConfiguredProviderType(conf, providerConfig)
  const type = normalizeProviderType(configuredType)
  let baseUrl

  if (type === 'gitlab') {
    assertConfigContainer(conf, 'gitlab')
    baseUrl = conf.get('gitlab:host')
  } else {
    assertConfigContainer(conf, 'enterprise')
    if (conf.get('enterprise:enable')) baseUrl = conf.get('enterprise:host')
  }

  return { type, baseUrl }
}

function getConfiguredProviderType (conf, providerConfig = conf.get('provider')) {
  if (providerConfig !== undefined) {
    if (typeof providerConfig === 'string') return providerConfig
    if (!isConfigContainer(providerConfig)) return providerConfig

    const providerType = getProviderConfigValue(providerConfig, 'type')
    if (providerType !== undefined) return providerType
  }

  return firstDefinedValue(
    conf.get('provider:type'),
    DEFAULT_PROVIDER_TYPE
  )
}

function assertConfigContainer (conf, key) {
  const value = conf.get(key)
  if (value !== undefined && !isConfigContainer(value)) {
    throw new Error(`Invalid ${key} configuration`)
  }
}

function isConfigContainer (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function firstDefinedValue (...values) {
  return values.find(value => value !== undefined)
}

function getProviderConfigValue (providerConfig, key) {
  if (!providerConfig || typeof providerConfig !== 'object') return undefined
  return providerConfig[key]
}

module.exports = {
  DEFAULT_PROVIDER_BASE_URLS,
  DEFAULT_PROVIDER_TYPE,
  getAccountStorageKey,
  getConfiguredProvider,
  getGitHubEnterpriseConfigError,
  getProviderConfigError,
  getProviderStorageKey,
  isDefaultGitHubProvider,
  normalizeProviderConfig
}
