function isStartAtLoginSupported (platform) {
  return platform === 'darwin' || platform === 'win32'
}

function normalizeStartAtLoginValue (value) {
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }
  return value === true
}

function applyStartAtLoginSetting ({ app, enabled, logger = console, platform = process.platform }) {
  const openAtLogin = normalizeStartAtLoginValue(enabled)

  if (!isStartAtLoginSupported(platform)) {
    if (openAtLogin) {
      logger.warn(`[startup] startAtLogin is not supported on ${platform}`)
    }
    return false
  }

  if (!app || typeof app.setLoginItemSettings !== 'function') {
    logger.warn('[startup] app.setLoginItemSettings is unavailable')
    return false
  }

  if (!openAtLogin && typeof app.getLoginItemSettings === 'function') {
    const currentSettings = app.getLoginItemSettings()
    if (currentSettings && currentSettings.openAtLogin === false) {
      logger.info('[startup] startAtLogin already disabled')
      return true
    }
  }

  app.setLoginItemSettings({
    openAtLogin
  })
  logger.info(`[startup] startAtLogin ${openAtLogin ? 'enabled' : 'disabled'}`)
  return true
}

module.exports = {
  applyStartAtLoginSetting,
  isStartAtLoginSupported,
  normalizeStartAtLoginValue
}
