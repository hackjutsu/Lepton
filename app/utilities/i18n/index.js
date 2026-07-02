const en = require('./locales/en')
const es = require('./locales/es')
const fr = require('./locales/fr')
const ja = require('./locales/ja')
const ko = require('./locales/ko')
const tr = require('./locales/tr')
const zhHans = require('./locales/zh-Hans')
const zhHant = require('./locales/zh-Hant')

const DEFAULT_LOCALE = 'en'
const catalogs = {
  en,
  es,
  fr,
  ja,
  ko,
  tr,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

const supportedLocales = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'zh-Hant', name: '繁體中文' }
]

let activeLocale = DEFAULT_LOCALE

function normalizeLocale (locale) {
  if (typeof locale !== 'string') return DEFAULT_LOCALE
  const trimmedLocale = locale.trim()
  return Object.prototype.hasOwnProperty.call(catalogs, trimmedLocale)
    ? trimmedLocale
    : DEFAULT_LOCALE
}

function configureI18n (locale) {
  activeLocale = normalizeLocale(locale)
  return activeLocale
}

function readPath (catalog, key) {
  if (!catalog || typeof key !== 'string') return undefined
  return key.split('.').reduce((value, segment) => {
    if (!value || !Object.prototype.hasOwnProperty.call(value, segment)) {
      return undefined
    }
    return value[segment]
  }, catalog)
}

function interpolate (message, values) {
  if (typeof message !== 'string') return message
  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) => {
    if (!values || !Object.prototype.hasOwnProperty.call(values, name)) return match
    return String(values[name])
  })
}

function t (key, values) {
  return translate(activeLocale, key, values)
}

function translate (locale, key, values) {
  const normalizedLocale = normalizeLocale(locale)
  const activeMessage = readPath(catalogs[normalizedLocale], key)
  const fallbackMessage = readPath(catalogs[DEFAULT_LOCALE], key)
  const message = activeMessage !== undefined ? activeMessage : fallbackMessage
  return interpolate(message !== undefined ? message : key, values)
}

function getLocale () {
  return activeLocale
}

function getSupportedLocales () {
  return supportedLocales.map(locale => Object.assign({}, locale))
}

module.exports = {
  configureI18n,
  getLocale,
  getSupportedLocales,
  t,
  translate
}
