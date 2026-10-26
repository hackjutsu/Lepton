import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const defaultConfig = require('../../configs/defaultConfig')
const {
  APPLY_MODES,
  DEFAULT_IMAGE_MAX_SIZE_KB,
  isValidPreferenceValue,
  normalizeImageMaxSizeKB,
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
      'editor:imageMaxSizeKB',
      'proxy:address',
      'enterprise:token',
      'shortcuts:keyAboutPage'
    ]))
  })

  it('defines application behavior for every writable preference', () => {
    expect(Object.keys(preferenceMetadata).sort()).toEqual([...writableConfigKeys].sort())
    expect(preferenceMetadata.theme.applyMode).toBe(APPLY_MODES.IMMEDIATE)
    expect(preferenceMetadata['snippet:downloadAll'].applyMode).toBe(APPLY_MODES.NEXT_USE)
    expect(preferenceMetadata['editor:imageMaxSizeKB'].applyMode).toBe(APPLY_MODES.NEXT_USE)
    expect(preferenceRequiresRestart('i18n:locale')).toBe(true)
    expect(preferenceRequiresRestart('proxy:address')).toBe(true)
    expect(preferenceRequiresRestart('notifications:success')).toBe(false)
    expect(preferenceRequiresRestart('unknown:key')).toBe(false)
  })

  it('validates values before writing .leptonrc', () => {
    expect(isValidPreferenceValue('theme', 'github-dark')).toBe(true)
    expect(isValidPreferenceValue('i18n:locale', 'fr')).toBe(true)
    expect(isValidPreferenceValue('editor:tabSize', 4)).toBe(true)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', 64)).toBe(true)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', 512)).toBe(true)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', 700)).toBe(true)
    expect(isValidPreferenceValue('notifications:success', false)).toBe(true)
    expect(isValidPreferenceValue('zoom:percent', 120)).toBe(true)
    expect(isValidPreferenceValue('proxy:address', 'pac+https://example.com/proxy.pac')).toBe(true)
    expect(isValidPreferenceValue('shortcuts:keyAboutPage', 'CommandOrControl+,')).toBe(true)
    expect(isValidPreferenceValue('theme', 'unknown')).toBe(false)
    expect(isValidPreferenceValue('editor:tabSize', 3)).toBe(false)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', 63)).toBe(false)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', 701)).toBe(false)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', 64.5)).toBe(false)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', '512')).toBe(false)
    expect(isValidPreferenceValue('zoom:percent', 400)).toBe(false)
    expect(isValidPreferenceValue('shortcuts:keyAboutPage', '')).toBe(false)
    expect(isValidPreferenceValue('unknown:key', 'secret')).toBe(false)
  })

  it('normalizes invalid image size settings to the documented default', () => {
    expect(normalizeImageMaxSizeKB(700)).toBe(700)
    expect(normalizeImageMaxSizeKB(undefined)).toBe(DEFAULT_IMAGE_MAX_SIZE_KB)
    expect(normalizeImageMaxSizeKB('512')).toBe(DEFAULT_IMAGE_MAX_SIZE_KB)
    expect(normalizeImageMaxSizeKB(701)).toBe(DEFAULT_IMAGE_MAX_SIZE_KB)
  })

  it('keeps image attachment defaults aligned with the documented limits', () => {
    expect(defaultConfig.editor.imageMaxSizeKB).toBe(DEFAULT_IMAGE_MAX_SIZE_KB)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', NaN)).toBe(false)
    expect(isValidPreferenceValue('editor:imageMaxSizeKB', undefined)).toBe(false)
  })
})
