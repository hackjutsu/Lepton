import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const defaultConfig = require('../../configs/defaultConfig')
const {
  APPLY_MODES,
  isSecretConfigKey,
  isValidPreferenceValue,
  preferenceMetadata,
  preferenceRequiresRestart,
  writableConfigKeys
} = require('../../app/utilities/config/preferences')

describe('preferences config boundary', () => {
  it('defaults to GitHub while keeping the public GitLab host ready to select', () => {
    expect(defaultConfig.provider.type).toBe('github')
    expect(defaultConfig.gitlab.host).toBe('gitlab.com')
    expect(defaultConfig.enterprise).not.toHaveProperty('token')
  })

  it('allowlists the preference page settings', () => {
    expect([...writableConfigKeys]).toEqual(expect.arrayContaining([
      'theme',
      'i18n:locale',
      'snippet:downloadAll',
      'editor:tabSize',
      'provider:type',
      'gitlab:host',
      'proxy:address',
      'shortcuts:keyAboutPage'
    ]))
    expect(writableConfigKeys.has('enterprise:token')).toBe(false)
  })

  it('defines application behavior for every writable preference', () => {
    expect(Object.keys(preferenceMetadata).sort()).toEqual([...writableConfigKeys].sort())
    expect(preferenceMetadata.theme.applyMode).toBe(APPLY_MODES.IMMEDIATE)
    expect(preferenceMetadata['snippet:downloadAll'].applyMode).toBe(APPLY_MODES.NEXT_USE)
    expect(preferenceRequiresRestart('i18n:locale')).toBe(true)
    expect(preferenceRequiresRestart('provider:type')).toBe(true)
    expect(preferenceRequiresRestart('gitlab:host')).toBe(true)
    expect(preferenceRequiresRestart('proxy:address')).toBe(true)
    expect(preferenceRequiresRestart('notifications:success')).toBe(false)
    expect(preferenceRequiresRestart('unknown:key')).toBe(false)
  })

  it('validates values before writing .leptonrc', () => {
    expect(isValidPreferenceValue('theme', 'github-dark')).toBe(true)
    expect(isValidPreferenceValue('i18n:locale', 'fr')).toBe(true)
    expect(isValidPreferenceValue('editor:tabSize', 4)).toBe(true)
    expect(isValidPreferenceValue('notifications:success', false)).toBe(true)
    expect(isValidPreferenceValue('zoom:percent', 120)).toBe(true)
    expect(isValidPreferenceValue('provider:type', 'github')).toBe(true)
    expect(isValidPreferenceValue('provider:type', 'gitlab')).toBe(true)
    expect(isValidPreferenceValue('gitlab:host', 'gitlab.example.com')).toBe(true)
    expect(isValidPreferenceValue('proxy:address', 'pac+https://example.com/proxy.pac')).toBe(true)
    expect(isValidPreferenceValue('shortcuts:keyAboutPage', 'CommandOrControl+,')).toBe(true)
    expect(isValidPreferenceValue('theme', 'unknown')).toBe(false)
    expect(isValidPreferenceValue('editor:tabSize', 3)).toBe(false)
    expect(isValidPreferenceValue('zoom:percent', 400)).toBe(false)
    expect(isValidPreferenceValue('provider:type', 'bitbucket')).toBe(false)
    expect(isValidPreferenceValue('gitlab:host', '   ')).toBe(false)
    expect(isValidPreferenceValue('gitlab:host', 'ftp://gitlab.example.com')).toBe(false)
    expect(isValidPreferenceValue('gitlab:host', 'not a host')).toBe(false)
    expect(isValidPreferenceValue('enterprise:token', 'must-stay-secret')).toBe(false)
    expect(isValidPreferenceValue('shortcuts:keyAboutPage', '')).toBe(false)
    expect(isValidPreferenceValue('unknown:key', 'secret')).toBe(false)
  })

  it('classifies legacy plaintext credential paths as secret config', () => {
    expect(isSecretConfigKey('enterprise:token')).toBe(true)
    expect(isSecretConfigKey('enterprise:token:metadata')).toBe(true)
    expect(isSecretConfigKey('enterprise')).toBe(true)
    expect(isSecretConfigKey('enterprise:host')).toBe(false)
    expect(isSecretConfigKey('provider:type')).toBe(false)
  })
})
