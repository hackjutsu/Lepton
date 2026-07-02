import { describe, expect, it, afterEach } from 'vitest'

import {
  configureI18n,
  getLocale,
  getSupportedLocales,
  t,
  translate
} from '../../app/utilities/i18n'
import builderConfig from '../../electron-builder'
import { getElectronLanguages } from '../../configs/electronLanguages'
import en from '../../app/utilities/i18n/locales/en'
import es from '../../app/utilities/i18n/locales/es'
import fr from '../../app/utilities/i18n/locales/fr'
import ja from '../../app/utilities/i18n/locales/ja'
import ko from '../../app/utilities/i18n/locales/ko'
import tr from '../../app/utilities/i18n/locales/tr'
import zhHans from '../../app/utilities/i18n/locales/zh-Hans'
import zhHant from '../../app/utilities/i18n/locales/zh-Hant'

const catalogs = {
  es,
  fr,
  ja,
  ko,
  tr,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

const allowedIdenticalValues = new Set([
  'app.name',
  'login.happyCoding',
  'login.tokenPlaceholder',
  'menu.gist',
  'menu.zoom',
  'snippet.raw'
])

function flattenCatalog (catalog, prefix = '') {
  return Object.keys(catalog).reduce((flatCatalog, key) => {
    const path = prefix ? `${prefix}.${key}` : key
    const value = catalog[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flatCatalog, flattenCatalog(value, path))
    } else {
      flatCatalog[path] = value
    }
    return flatCatalog
  }, {})
}

describe('i18n utilities', () => {
  afterEach(() => {
    configureI18n('en')
  })

  it('defaults to English for unsupported locales', () => {
    expect(configureI18n('it')).toBe('en')
    expect(getLocale()).toBe('en')
    expect(t('login.title')).toBe('Login')
  })

  it('uses the configured locale when it is supported', () => {
    expect(configureI18n('ja')).toBe('ja')
    expect(getLocale()).toBe('ja')
    expect(t('login.title')).toBe('ログイン')
  })

  it('supports Spanish and script-based Chinese locales', () => {
    expect(configureI18n('es')).toBe('es')
    expect(t('login.title')).toBe('Iniciar sesion')

    expect(configureI18n('zh-Hans')).toBe('zh-Hans')
    expect(t('login.title')).toBe('登录')

    expect(configureI18n('zh-Hant')).toBe('zh-Hant')
    expect(t('login.title')).toBe('登入')
  })

  it('supports French and Korean locales', () => {
    expect(configureI18n('fr')).toBe('fr')
    expect(t('login.title')).toBe('Connexion')

    expect(configureI18n('ko')).toBe('ko')
    expect(t('login.title')).toBe('로그인')
  })

  it('supports Turkish locale', () => {
    expect(configureI18n('tr')).toBe('tr')
    expect(t('login.title')).toBe('Giriş')
    expect(t('login.continueAs', { username: 'octocat' })).toBe('octocat olarak devam et')
  })

  it('interpolates named values', () => {
    configureI18n('en')
    expect(t('login.continueAs', { username: 'octocat' })).toBe('Continue as octocat')
  })

  it('translates a specific locale without changing the active locale', () => {
    configureI18n('en')
    expect(translate('ja', 'login.title')).toBe('ログイン')
    expect(getLocale()).toBe('en')
    expect(t('login.title')).toBe('Login')
  })

  it('falls back to English for missing keys in a supported locale', () => {
    configureI18n('ja')
    expect(t('app.name')).toBe('Lepton')
  })

  it('falls back to the key name when no catalog contains the key', () => {
    configureI18n('ja')
    expect(t('missing.translation.key')).toBe('missing.translation.key')
  })

  it('returns supported locale metadata defensively', () => {
    const locales = getSupportedLocales()
    expect(locales).toEqual([
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
      { code: 'tr', name: 'Türkçe' },
      { code: 'zh-Hans', name: '简体中文' },
      { code: 'zh-Hant', name: '繁體中文' }
    ])

    locales[0].name = 'Mutated'
    expect(getSupportedLocales()[0].name).toBe('English')
  })

  it('keeps packaged Electron locales in sync with supported locales', () => {
    expect(builderConfig.electronLanguages).toEqual(getElectronLanguages(getSupportedLocales()))
  })

  it('maps script-specific Chinese locales to Electron resource names', () => {
    expect(getElectronLanguages([
      { code: 'zh-Hans' },
      { code: 'zh-Hant' }
    ])).toEqual([
      ['zh', String.fromCharCode(67, 78)].join('_'),
      ['zh', String.fromCharCode(84, 87)].join('_')
    ])
  })

  it('keeps every locale catalog in the same shape as English', () => {
    const englishCatalog = flattenCatalog(en)
    const englishKeys = Object.keys(englishCatalog).sort()

    Object.keys(catalogs).forEach(locale => {
      expect(Object.keys(flattenCatalog(catalogs[locale])).sort()).toEqual(englishKeys)
    })
  })

  it('requires every locale catalog to translate non-brand phrases', () => {
    const englishCatalog = flattenCatalog(en)

    Object.keys(catalogs).forEach(locale => {
      const catalog = flattenCatalog(catalogs[locale])
      const untranslatedKeys = Object.keys(englishCatalog)
        .filter(key => !allowedIdenticalValues.has(key))
        .filter(key => catalog[key] === englishCatalog[key])

      expect(untranslatedKeys).toEqual([])
    })
  })
})
