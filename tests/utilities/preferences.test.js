import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  APPLY_MODES,
  isValidPreferenceValue,
  preferenceMetadata,
  preferenceRequiresRestart,
  writableConfigKeys
} = require('../../app/utilities/config/preferences')

describe('preferences config boundary', () => {
  it('allowlists the preference page settings', () => {
    expect([...writableConfigKeys]).toEqual(expect.arrayContaining([
      'theme',
      'i18n:locale',
      'snippet:downloadAll',
      'editor:tabSize',
      'proxy:address',
      'enterprise:token',
      'shortcuts:keyAboutPage'
    ]))
  })

  it('defines application behavior for every writable preference', () => {
    expect(Object.keys(preferenceMetadata).sort()).toEqual([...writableConfigKeys].sort())
    expect(preferenceMetadata.theme.applyMode).toBe(APPLY_MODES.IMMEDIATE)
    expect(preferenceMetadata['snippet:downloadAll'].applyMode).toBe(APPLY_MODES.NEXT_USE)
    expect(preferenceRequiresRestart('i18n:locale')).toBe(true)
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
    expect(isValidPreferenceValue('proxy:address', 'pac+https://example.com/proxy.pac')).toBe(true)
    expect(isValidPreferenceValue('shortcuts:keyAboutPage', 'CommandOrControl+,')).toBe(true)
    expect(isValidPreferenceValue('theme', 'unknown')).toBe(false)
    expect(isValidPreferenceValue('editor:tabSize', 3)).toBe(false)
    expect(isValidPreferenceValue('zoom:percent', 400)).toBe(false)
    expect(isValidPreferenceValue('shortcuts:keyAboutPage', '')).toBe(false)
    expect(isValidPreferenceValue('unknown:key', 'secret')).toBe(false)
  })
})
