import { describe, expect, it } from 'vitest'
import providerAccessPolicy from '../../app/utilities/providerAccessPolicy'

const {
  createProviderAccessPolicy,
  isCredentialStorageKey
} = providerAccessPolicy

function createConf (values = {}) {
  return {
    get: key => values[key]
  }
}

describe('provider access policy', () => {
  it('allows only the currently configured provider and credential scope', () => {
    const policy = createProviderAccessPolicy({
      conf: createConf({
        'provider:type': 'gitlab',
        'gitlab:host': 'https://gitlab.example.test/Team'
      })
    })

    expect(policy.isActiveProvider({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test/Team'
    })).toBe(true)
    expect(policy.canReadCredential('gitlab:https://gitlab.example.test/Team')).toBe(true)
    expect(policy.isActiveProvider({
      type: 'gitlab',
      baseUrl: 'https://gitlab.example.test/team'
    })).toBe(false)
    expect(policy.canReadCredential('github:https://github.com')).toBe(false)
  })

  it('allows unscoped legacy credentials to be cleared but never read or written', () => {
    const policy = createProviderAccessPolicy({ conf: createConf() })

    expect(policy.canReadCredential()).toBe(false)
    expect(policy.canWriteCredential('legacy-token')).toBe(false)
    expect(policy.canWriteCredential(null)).toBe(true)
  })

  it('fails closed for malformed self-managed provider configuration', () => {
    const policy = createProviderAccessPolicy({
      conf: createConf({
        'provider:type': 'gitlab',
        'gitlab:host': 'file:///tmp/gitlab'
      })
    })

    expect(policy.isActiveProvider({
      type: 'gitlab',
      baseUrl: 'https://gitlab.com'
    })).toBe(false)
    expect(policy.canReadCredential('gitlab:https://gitlab.com')).toBe(false)
    expect(policy.canWriteCredential('private-token', 'gitlab:https://gitlab.com')).toBe(false)
    expect(policy.canWriteCredential(null)).toBe(true)
  })

  it.each(['', '   '])('fails closed for an explicitly blank GitLab host %j', host => {
    const policy = createProviderAccessPolicy({
      conf: createConf({
        'provider:type': 'gitlab',
        'gitlab:host': host
      })
    })

    expect(policy.isActiveProvider({
      type: 'gitlab',
      baseUrl: 'https://gitlab.com'
    })).toBe(false)
    expect(policy.canReadCredential('gitlab:https://gitlab.com')).toBe(false)
    expect(policy.canWriteCredential('private-token', 'gitlab:https://gitlab.com')).toBe(false)
  })

  it.each(['', null])('fails closed for an invalid explicit provider type %j', providerType => {
    const policy = createProviderAccessPolicy({
      conf: createConf({ 'provider:type': providerType })
    })

    expect(policy.isActiveProvider({ type: 'github', baseUrl: 'https://github.com' })).toBe(false)
    expect(policy.canReadCredential('github:https://github.com')).toBe(false)
    expect(policy.canWriteCredential('github-token', 'github:https://github.com')).toBe(false)
  })

  it('recognizes plain and encrypted token storage keys through basename aliases', () => {
    expect(isCredentialStorageKey('token')).toBe(true)
    expect(isCredentialStorageKey('TOKEN.json')).toBe(true)
    expect(isCredentialStorageKey('../token:github%3Ahttps%3A%2F%2Fgithub.com')).toBe(true)
    expect(isCredentialStorageKey('encrypted-token:gitlab%3Ahttps%3A%2F%2Fgitlab.com')).toBe(true)
    expect(isCredentialStorageKey('profile:github%3Ahttps%3A%2F%2Fgithub.com')).toBe(false)
  })

  it('blocks direct aliases for hashed scoped-storage files', () => {
    const digest = '913e6e0dbc93cc7f92a8bf2b8430544e005ca0e5269334458c22dcbf656ba5d8'
    const alias = `scoped-v1-${digest}`

    expect(isCredentialStorageKey(alias)).toBe(true)
    expect(isCredentialStorageKey(`${alias}.json`)).toBe(true)
    expect(isCredentialStorageKey(`../${alias}`)).toBe(true)
    expect(isCredentialStorageKey(alias.toUpperCase())).toBe(true)
    expect(isCredentialStorageKey('profile:github%3Ahttps%3A%2F%2Fgithub.com')).toBe(false)
    expect(isCredentialStorageKey('new-gist-draft-github%3Ahttps%3A%2F%2Fgithub.com%3Aocto')).toBe(false)
  })
})
