// Electron packages Chromium locale resources by .pak filename, which does not
// always match Lepton's app-facing locale id.
const electronLanguageOverrides = {
  en: 'en-US',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW'
}

function toElectronLanguage (locale) {
  return electronLanguageOverrides[locale] || locale
}

function getElectronLanguages (supportedLocales) {
  return supportedLocales.map(locale => toElectronLanguage(locale.code || locale))
}

module.exports = {
  getElectronLanguages,
  toElectronLanguage
}
