const noopLogger = {
  debug: () => {},
  warn: () => {}
}

async function clearGitHubAuthWindowStorageAndDestroy ({
  authWindow,
  logger = noopLogger
} = {}) {
  if (!authWindow || authWindow.isDestroyed()) return

  let clearResult
  try {
    clearResult = authWindow.webContents.session.clearStorageData({})
  } catch (err) {
    logger.warn('[auth] Failed to clear OAuth session data: ' + err.message)
    destroyGitHubAuthWindow(authWindow, logger)
    return
  }

  if (clearResult && typeof clearResult.then === 'function') {
    try {
      await clearResult
      logger.debug('[auth] OAuth session storage cleared')
    } catch (err) {
      logger.warn('[auth] Failed to clear OAuth session data: ' + err.message)
    } finally {
      destroyGitHubAuthWindow(authWindow, logger)
    }
    return
  }

  logger.debug('[auth] OAuth session storage clear requested')
  destroyGitHubAuthWindow(authWindow, logger)
}

function destroyGitHubAuthWindow (authWindow, logger = noopLogger) {
  if (!authWindow || authWindow.isDestroyed()) return
  logger.debug('[auth] Destroying OAuth auth window')
  authWindow.destroy()
}

module.exports = {
  clearGitHubAuthWindowStorageAndDestroy
}
