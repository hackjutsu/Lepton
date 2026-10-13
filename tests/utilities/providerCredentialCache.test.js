import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import {
  getProviderCacheKeys,
  readProviderCachedUserInfo
} from '../../app/utilities/providerCredentialCache'

const require = createRequire(import.meta.url)
const { getStorageFilePath } = require('../../app/utilities/electronLocalStorage')

function createStorage (values) {
  return {
    get: vi.fn(key => Object.prototype.hasOwnProperty.call(values, key)
      ? { status: true, data: values[key] }
      : { status: false, data: null })
  }
}

describe('provider credential cache', () => {
  it('reads only the exact provider-scoped credential and profile', () => {
    const provider = { type: 'github', baseUrl: 'https://ghe.example.test' }
    const cache = getProviderCacheKeys(provider)
    const localStorage = createStorage({ [cache.profileKey]: 'octo' })
    const credentials = {
      getAccessToken: vi.fn(scope => scope === cache.credentialScope
        ? { status: true, data: 'ghe-token' }
        : { status: true, data: 'ambiguous-legacy-token' })
    }

    expect(readProviderCachedUserInfo({ provider, credentials, localStorage }))
      .toEqual(expect.objectContaining({ token: 'ghe-token', profile: 'octo', provider }))
    expect(credentials.getAccessToken).toHaveBeenCalledTimes(1)
    expect(credentials.getAccessToken).toHaveBeenCalledWith(cache.credentialScope)
  })

  it('never treats an unscoped legacy token as canonical GitHub credentials', () => {
    const provider = { type: 'github', baseUrl: 'https://github.com' }
    const credentials = {
      getAccessToken: vi.fn(scope => scope
        ? { status: false, data: null }
        : { status: true, data: 'ambiguous-legacy-token' })
    }

    expect(readProviderCachedUserInfo({
      provider,
      credentials,
      localStorage: createStorage({ profile: 'legacy-user' })
    })).toBeNull()
    expect(credentials.getAccessToken).toHaveBeenCalledTimes(1)
    expect(credentials.getAccessToken).toHaveBeenCalledWith('github:https://github.com')
  })

  it('keeps caches for case-sensitive self-managed paths distinct', () => {
    const upperPathCache = getProviderCacheKeys({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test/Team'
    })
    const lowerPathCache = getProviderCacheKeys({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test/team'
    })

    expect(upperPathCache.credentialScope).not.toBe(lowerPathCache.credentialScope)
    expect(upperPathCache.profileKey).not.toBe(lowerPathCache.profileKey)
    expect(getStorageFilePath('/tmp/lepton', upperPathCache.profileKey).toLowerCase())
      .not.toBe(getStorageFilePath('/tmp/lepton', lowerPathCache.profileKey).toLowerCase())
  })

  it('keeps profile caches distinct when one provider path ends in .json', () => {
    const tenantCache = getProviderCacheKeys({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test/tenant'
    })
    const jsonTenantCache = getProviderCacheKeys({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test/tenant.json'
    })

    expect(getStorageFilePath('/tmp/lepton', tenantCache.profileKey))
      .not.toBe(getStorageFilePath('/tmp/lepton', jsonTenantCache.profileKey))
  })
})
