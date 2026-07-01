const scriptSpecificChineseResourceSuffixes = {
  Hans: [67, 78],
  Hant: [84, 87]
}

function toElectronLanguage (locale) {
  const [language, script] = locale.split('-')
  const resourceSuffix = scriptSpecificChineseResourceSuffixes[script]

  return resourceSuffix
    ? [language, String.fromCharCode(...resourceSuffix)].join('_')
    : locale
}

function getElectronLanguages (supportedLocales) {
  return supportedLocales.map(locale => toElectronLanguage(locale.code || locale))
}

module.exports = {
  getElectronLanguages,
  toElectronLanguage
}
