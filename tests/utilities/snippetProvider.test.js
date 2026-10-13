import { describe, expect, it } from 'vitest'
import nconf from 'nconf'
import snippetProvider from '../../app/utilities/snippetProvider'
import defaultConfig from '../../configs/defaultConfig'

const {
  getAccountStorageKey,
  getConfiguredProvider,
  getProviderStorageKey,
  getGitHubEnterpriseConfigError,
  getProviderConfigError,
  isDefaultGitHubProvider,
  normalizeProviderConfig
} = snippetProvider

function createConf (values = {}) {
  return {
    get: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined
  }
}

function createRealConf (overrides) {
  const conf = new nconf.Provider()
  conf.overrides(overrides)
  conf.defaults(defaultConfig)
  return conf
}

describe('snippet provider configuration', () => {
  it('defaults to GitHub and normalizes provider URLs', () => {
    expect(normalizeProviderConfig()).toEqual({
      type: 'github',
      baseUrl: 'https://github.com'
    })
    expect(normalizeProviderConfig({
      type: 'GitLab',
      baseUrl: 'gitlab.example.test/team/api/v4/'
    })).toEqual({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test/team'
    })
  })

  it('reads GitLab host configuration', () => {
    const provider = getConfiguredProvider(createConf({
      provider: { type: 'gitlab' },
      'gitlab:host': 'gitlab.example.test'
    }))

    expect(provider).toEqual({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test'
    })
  })

  it('uses provider-specific hosts instead of stale generic endpoint fields', () => {
    expect(getConfiguredProvider(createConf({
      provider: { type: 'gitlab', baseUrl: 'https://old.example.test' },
      'provider:baseUrl': 'https://also-old.example.test',
      'gitlab:baseUrl': 'https://unsupported-alias.example.test',
      'gitlab:host': 'https://new.example.test'
    }))).toEqual({
      type: 'gitlab',
      baseUrl: 'https://new.example.test'
    })

    expect(getConfiguredProvider(createConf({
      provider: { type: 'github', baseUrl: 'https://old.example.test' },
      'provider:baseUrl': 'https://also-old.example.test',
      'gitlab:host': 'https://new.example.test'
    }))).toEqual({
      type: 'github',
      baseUrl: 'https://github.com'
    })
  })

  it('supports a compact string provider configuration', () => {
    const provider = getConfiguredProvider(createConf({
      provider: 'gitlab',
      'gitlab:host': 'gitlab.example.test'
    }))

    expect(provider.type).toBe('gitlab')
  })

  it('keeps legacy GitHub Enterprise configuration working', () => {
    const provider = getConfiguredProvider(createConf({
      'enterprise:enable': true,
      'enterprise:host': 'ghe.example.test'
    }))

    expect(provider).toEqual({
      type: 'github',
      baseUrl: 'https://ghe.example.test'
    })
  })

  it('preserves malformed configured hosts so provider use fails closed', () => {
    expect(getConfiguredProvider(createConf({
      provider: { type: 'gitlab' },
      'gitlab:host': 'file:///tmp/gitlab'
    }))).toEqual({
      type: 'gitlab',
      baseUrl: 'file:///tmp/gitlab'
    })

    expect(getConfiguredProvider(createConf({
      provider: { type: 'bitbucket' }
    }))).toEqual({
      type: 'bitbucket',
      baseUrl: ''
    })
  })

  it.each(['', null, false, 0])('preserves an invalid explicit provider type %j so access fails closed', providerType => {
    const conf = createConf({ 'provider:type': providerType })

    expect(getConfiguredProvider(conf)).toEqual({
      type: providerType,
      baseUrl: ''
    })
    expect(getProviderConfigError(conf)).toBe('Select a supported snippet provider in Settings.')
  })

  it.each([false, null, 0, []])('rejects a malformed root provider value %j despite nconf defaults', provider => {
    const conf = createRealConf({ provider })

    expect(getProviderConfigError(conf)).toBe('Select a supported snippet provider in Settings.')
    expect(() => normalizeProviderConfig(getConfiguredProvider(conf))).toThrow()
  })

  it('rejects malformed GitLab and Enterprise root containers despite nconf defaults', () => {
    const malformedGitLab = createRealConf({
      provider: { type: 'gitlab' },
      gitlab: false
    })
    const malformedEnterprise = createRealConf({
      provider: { type: 'github' },
      enterprise: 'enabled'
    })

    expect(getProviderConfigError(malformedGitLab)).not.toBeNull()
    expect(() => normalizeProviderConfig(getConfiguredProvider(malformedGitLab))).toThrow()
    expect(getProviderConfigError(malformedEnterprise)).not.toBeNull()
    expect(() => normalizeProviderConfig(getConfiguredProvider(malformedEnterprise))).toThrow()
  })

  it('reports malformed active provider configuration before authentication', () => {
    expect(getProviderConfigError(createConf({
      provider: { type: 'gitlab' },
      'gitlab:host': 'file:///tmp/gitlab'
    }))).toBe('Enter a valid HTTP or HTTPS GitLab instance.')
    expect(getProviderConfigError(createConf({
      provider: { type: 'gitlab' },
      'gitlab:host': 'gitlab.example.test'
    }))).toBeNull()
    expect(getProviderConfigError(createConf({
      provider: { type: 'gitlab' },
      'gitlab:host': ''
    }))).toBe('Enter a valid HTTP or HTTPS GitLab instance.')
    expect(getProviderConfigError(createConf({
      provider: { type: 'gitlab' },
      'gitlab:host': '   '
    }))).toBe('Enter a valid HTTP or HTTPS GitLab instance.')
    expect(getProviderConfigError(createConf({
      provider: { type: 'github', baseUrl: 'file:///tmp/github' }
    }))).toBeNull()
    expect(getProviderConfigError(createConf({
      provider: { type: 'bitbucket' }
    }))).toBe('Select a supported snippet provider in Settings.')
  })

  it('creates stable provider and account storage keys', () => {
    const provider = normalizeProviderConfig({
      type: 'gitlab',
      baseUrl: 'https://GitLab.Example.Test/'
    })

    expect(getProviderStorageKey(provider)).toBe('gitlab:https://gitlab.example.test')
    expect(getAccountStorageKey(provider, 'Octo')).toBe('gitlab:https://gitlab.example.test:octo')
  })

  it('distinguishes canonical GitHub from Enterprise instances', () => {
    expect(isDefaultGitHubProvider({ type: 'github', baseUrl: 'https://github.com/' })).toBe(true)
    expect(isDefaultGitHubProvider({ type: 'github', baseUrl: 'https://ghe.example.test' })).toBe(false)
    expect(isDefaultGitHubProvider({ type: 'gitlab', baseUrl: 'https://gitlab.com' })).toBe(false)
  })

  it('rejects missing or malformed enabled GitHub Enterprise hosts', () => {
    expect(getGitHubEnterpriseConfigError(createConf())).toBeNull()
    expect(getGitHubEnterpriseConfigError(createConf({
      'enterprise:enable': true,
      'enterprise:host': ''
    }))).toBe('Enter a valid GitHub Enterprise host in Settings.')
    expect(getGitHubEnterpriseConfigError(createConf({
      'enterprise:enable': true,
      'enterprise:host': 'file:///tmp/github'
    }))).toBe('Enter a valid GitHub Enterprise host in Settings.')
    expect(getGitHubEnterpriseConfigError(createConf({
      'enterprise:enable': true,
      'enterprise:host': 'ghe.example.test'
    }))).toBeNull()
  })

  it('rejects unsupported provider types and protocols', () => {
    expect(() => normalizeProviderConfig({ type: 'bitbucket' }))
      .toThrow('Unsupported snippet provider: bitbucket')
    expect(() => normalizeProviderConfig({ type: '' }))
      .toThrow('Unsupported snippet provider')
    expect(() => normalizeProviderConfig({ type: null }))
      .toThrow('Unsupported snippet provider')
    expect(() => normalizeProviderConfig({ type: 'gitlab', baseUrl: 'file:///tmp/gitlab' }))
      .toThrow('Unsupported gitlab provider URL protocol: file:')
    expect(() => normalizeProviderConfig({ type: 'gitlab', baseUrl: '' }))
      .toThrow('Invalid gitlab provider URL')
    expect(() => normalizeProviderConfig({ type: 'gitlab', baseUrl: '   ' }))
      .toThrow('Invalid gitlab provider URL')
  })
})
