import { getProviderStorageKey } from './snippetProvider'

export function getProviderCacheKeys (provider) {
  const credentialScope = getProviderStorageKey(provider)
  return {
    credentialScope,
    profileKey: `profile:${encodeURIComponent(credentialScope)}`,
    provider
  }
}

export function readProviderCachedUserInfo ({ provider, credentials, localStorage }) {
  const cache = getProviderCacheKeys(provider)
  const cachedProfile = localStorage.get(cache.profileKey)
  const cachedToken = credentials.getAccessToken(cache.credentialScope)

  if (!cachedProfile.status || !cachedProfile.data || !cachedToken.status || !cachedToken.data) {
    return null
  }

  return {
    token: cachedToken.data,
    profile: cachedProfile.data,
    provider: cache.provider,
    providerType: cache.provider.type
  }
}
