const { createGitHubApi } = require('../githubApi/core')
const { createGitLabApi } = require('../gitlabApi/core')
const {
  getConfiguredProvider,
  getProviderStorageKey,
  normalizeProviderConfig
} = require('../snippetProvider')

const DEFAULT_PROVIDER_FACTORIES = Object.freeze({
  github: createGitHubApi,
  gitlab: createGitLabApi
})

function createSnippetApi ({
  conf,
  fetchImpl,
  logger,
  providerFactories = DEFAULT_PROVIDER_FACTORIES,
  providerOptions = {}
} = {}) {
  const configuredProvider = getConfiguredProvider(conf)
  const providerApis = new Map()

  function getSnippetApi (provider, operation) {
    if (operation === undefined) {
      operation = provider
      provider = configuredProvider
    }

    const normalizedProvider = normalizeProviderConfig(provider || configuredProvider)
    return getProviderApi(normalizedProvider).getRequest(operation)
  }

  function getProviderApi (provider) {
    const key = getProviderStorageKey(provider)
    if (providerApis.has(key)) return providerApis.get(key)

    const factory = providerFactories[provider.type]
    if (typeof factory !== 'function') {
      throw new Error(`No API adapter for snippet provider: ${provider.type}`)
    }

    const providerApi = factory(Object.assign({}, providerOptions[provider.type], {
      conf,
      fetchImpl,
      logger,
      provider
    }))
    assertProviderAdapter(providerApi, provider.type)
    providerApis.set(key, providerApi)
    return providerApi
  }

  return { getSnippetApi }
}

function assertProviderAdapter (providerApi, expectedType) {
  if (!providerApi || providerApi.type !== expectedType || typeof providerApi.getRequest !== 'function') {
    throw new Error(`Invalid API adapter for snippet provider: ${expectedType}`)
  }
}

module.exports = {
  createSnippetApi
}
