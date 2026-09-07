const { getSupportedLocales } = require('../i18n')

const THEMES = [
  'light',
  'dark',
  'one-dark',
  'atom-one-dark',
  'github-light',
  'github-dark',
  'catppuccin-latte',
  'catppuccin-mocha',
  'solarized-light',
  'solarized-dark',
  'dracula',
  'material-theme',
  'ayu'
]

const booleanKeys = new Set([
  'autoUpdate',
  'startAtLogin',
  'window:closeToTray',
  'window:minimizeToTray',
  'userPanel:hideProfilePhoto',
  'proxy:enable',
  'snippet:sortingReverse',
  'snippet:expanded',
  'snippet:newSnippetPrivate',
  'snippet:downloadAll',
  'tag:showInSnippetList',
  'tag:colored',
  'editor:validateFilename',
  'enterprise:enable',
  'notifications:success',
  'notifications:failure'
])

const shortcutKeys = [
  'keyShortcutForSearch', 'keyNewGist', 'keyEditGist', 'keyDeleteGist',
  'keySubmitGist', 'keyImmersiveMode', 'keyAboutPage', 'keyDashboard', 'keySyncGists'
].map(key => `shortcuts:${key}`)

const stringKeys = new Set([
  'proxy:address',
  'enterprise:host',
  'enterprise:token',
  'enterprise:avatarUrl',
  ...shortcutKeys
])

const APPLY_MODES = {
  IMMEDIATE: 'immediate',
  NEXT_USE: 'next-use',
  RESTART: 'restart'
}

function metadataForKeys (keys, applyMode) {
  return keys.reduce((metadata, key) => {
    metadata[key] = { applyMode }
    return metadata
  }, {})
}

const preferenceMetadata = {
  ...metadataForKeys([
    'theme', 'autoUpdate', 'startAtLogin', 'zoom:percent', 'logger:level', ...shortcutKeys
  ], APPLY_MODES.IMMEDIATE),
  ...metadataForKeys([
    'window:closeToTray', 'window:minimizeToTray', 'security:cachedAccessTokenStorage',
    'snippet:sorting', 'snippet:sortingReverse', 'snippet:downloadAll',
    'tag:showInSnippetList', 'tag:colored', 'editor:validateFilename',
    'notifications:success', 'notifications:failure'
  ], APPLY_MODES.NEXT_USE),
  ...metadataForKeys([
    'i18n:locale', 'avatar:type', 'avatar:boringAvatarVariant', 'userPanel:hideProfilePhoto',
    'proxy:enable', 'proxy:address', 'snippet:expanded', 'snippet:newSnippetPrivate',
    'editor:tabSize', 'enterprise:enable', 'enterprise:host', 'enterprise:token',
    'enterprise:avatarUrl'
  ], APPLY_MODES.RESTART)
}

const writableConfigKeys = new Set(Object.keys(preferenceMetadata))

function preferenceRequiresRestart (key) {
  return Boolean(preferenceMetadata[key] && preferenceMetadata[key].applyMode === APPLY_MODES.RESTART)
}

function isValidPreferenceValue (key, value) {
  if (!writableConfigKeys.has(key)) return false
  if (booleanKeys.has(key)) return typeof value === 'boolean'
  if (stringKeys.has(key)) {
    if (typeof value !== 'string' || value.length > 500) return false
    return !key.startsWith('shortcuts:') || value.trim().length > 0
  }
  if (key === 'theme') return THEMES.includes(value)
  if (key === 'i18n:locale') {
    return getSupportedLocales().some(locale => locale.code === value)
  }
  if (key === 'editor:tabSize') {
    return Number.isInteger(value) && [2, 4, 8].includes(value)
  }
  if (key === 'zoom:percent') return Number.isInteger(value) && value >= 50 && value <= 300
  if (key === 'avatar:type') return ['github', 'boring'].includes(value)
  if (key === 'avatar:boringAvatarVariant') return ['beam', 'marble', 'pixel', 'sunset', 'ring', 'bauhaus'].includes(value)
  if (key === 'logger:level') return ['debug', 'info', 'warn', 'error'].includes(value)
  if (key === 'security:cachedAccessTokenStorage') return ['auto', 'encrypted', 'file'].includes(value)
  if (key === 'snippet:sorting') return ['updated_at', 'created_at', 'description'].includes(value)
  return false
}

module.exports = {
  APPLY_MODES,
  isValidPreferenceValue,
  preferenceMetadata,
  preferenceRequiresRestart,
  THEMES,
  writableConfigKeys
}
