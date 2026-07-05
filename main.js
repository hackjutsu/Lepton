const os = require('os')
const electron = require('electron')
const nconf = require('nconf')
const windowStateKeeper = require('electron-window-state')
const Menu = electron.Menu
const app = electron.app
const dialog = electron.dialog
const Tray = electron.Tray
const ipcMain = electron.ipcMain
const BrowserWindow = electron.BrowserWindow
let isQuitting = false

// http://electron.rocks/sharing-between-main-and-renderer-process/
// Set up the logger
const winston = require('winston')
const path = require('path')
const fs = require('fs')
const isDev = require('electron-is-dev')
const { pathToFileURL } = require('url')
const defaultConfig = require('./configs/defaultConfig')
const appInfo = require('./package.json')
const { createMainLogger } = require('./app/utilities/logging/mainLogger')
const { installLoggerRedaction } = require('./app/utilities/logging/redact')
const { applyStartAtLoginSetting } = require('./app/utilities/startAtLogin')
const { applyElectronProxy } = require('./app/utilities/electronProxy')
const { configureI18n, t } = require('./app/utilities/i18n')
const { createAccessTokenStorage } = require('./app/utilities/accessTokenStorage')
const { createElectronLocalStorage } = require('./app/utilities/electronLocalStorage')
const {
  getUpdateCheckDecision,
  getUpdateNotificationDecision
} = require('./app/utilities/updatePolicy')
const {
  buildGitHubOAuthUrl,
  describeGitHubOAuthUrl,
  parseGitHubOAuthCallback,
  shouldIgnoreGitHubOAuthLoadFailure,
  shouldDisableGitHubOAuthHardwareAccelerationWorkaround,
  shouldSandboxGitHubOAuthWindow
} = require('./app/utilities/auth/githubOAuth')
const {
  clearGitHubAuthWindowStorageAndDestroy
} = require('./app/utilities/auth/githubAuthWindow')
const { applyDefaultZoomPercent } = require('./app/utilities/zoom')

const logger = createMainLogger()
applyGitHubOAuthRenderWorkarounds()
const electronLocalStorage = createElectronLocalStorage({
  getUserDataPath: () => app.getPath('userData')
})
const accessTokenStorage = createAccessTokenStorage({
  conf: nconf,
  getSafeStorage: () => electron.safeStorage,
  isDev,
  localStorage: electronLocalStorage,
  logger
})

const { autoUpdater } = require("electron-updater")
autoUpdater.logger = logger
autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false

initGlobalConfigs()
configureI18n(nconf.get('i18n:locale'))
autoUpdater.autoDownload = nconf.get('autoUpdate')
initGlobalLogger()
setUpBridgeIpcHandlers()

logger.info(`\n\n----- ${appInfo.name} v${appInfo.version} ${os.platform()}-----\n`)

logger.info(`[conf] Looking for .leptonrc at ${getConfigPath()}`)
logger.info('[conf] The resolved configuration is ...')
for (const key of Object.getOwnPropertyNames(defaultConfig)) {
  logger.info(`"${key}": ${JSON.stringify(nconf.get(key))}`)    
}

let mainWindow = null
let tray = null
let authFlow = null
let githubApi = null
let operationType = 0

const MACOS_TRAY_ICON_SIZE = 18

const shortcuts = nconf.get('shortcuts')

function applyGitHubOAuthRenderWorkarounds () {
  if (!shouldDisableGitHubOAuthHardwareAccelerationWorkaround(process.platform)) return

  app.disableHardwareAcceleration()
  logger.info('[auth] Disabled Electron hardware acceleration for Windows GitHub OAuth rendering stability')
}

function getConfigPath() {
  if (process && process.env && process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, '.leptonrc')
  } else {
    return path.join(app.getPath('home'), '.leptonrc')
  }       
}

function shouldCheckForUpdates () {
  const decision = getUpdateCheckDecision({
    autoUpdate: nconf.get('autoUpdate'),
    currentVersion: appInfo.version,
    isDev
  })

  if (!decision.shouldCheck) {
    logger.debug('[autoUpdater] update check skipped: ' + decision.reason)
  }

  return decision.shouldCheck
}

function getRendererUrl () {
  const rendererUrl = pathToFileURL(path.join(__dirname, 'index.html'))
  if (process.env.LEPTON_RENDER_FIXTURE) {
    rendererUrl.searchParams.set('renderFixture', process.env.LEPTON_RENDER_FIXTURE)
  }
  return rendererUrl.toString()
}

function checkForAppUpdates ({ notify = false } = {}) {
  if (!shouldCheckForUpdates()) {
    return
  }

  const updateCheck = notify
    ? autoUpdater.checkForUpdatesAndNotify()
    : autoUpdater.checkForUpdates()

  if (updateCheck && typeof updateCheck.catch === 'function') {
    updateCheck.catch(err => {
      const message = err && err.stack
        ? err.stack
        : err && err.message
          ? err.message
          : JSON.stringify(err)
      logger.debug('[autoUpdater] update check failed ' + message)
    })
  }
}

function createWindowAndAutoLogin () {
  createWindow(true)
}

function createWindow (autoLogin) {
  console.time('init')
    // Load the previous state with fallback to defaults
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1100,
    defaultHeight: 800
  })

  const webPreferences = {
    nodeIntegration: false,
    enableRemoteModule: false,
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    sandbox: true
  }

  mainWindow = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    minWidth: 636,
    minHeight: 609,
    // titleBarStyle: 'hidden',
    backgroundColor: '#808080',
    show: false,
    icon: path.join(__dirname, 'build/icon/icon.png'),
    webPreferences
  })

  if (autoLogin) {
    logger.debug('-----> registering login-page-ready listener')
    ipcMain.once('login-page-ready', () => {
      logger.info('[signal] sending auto-login signal')        
      mainWindow.webContents.send('auto-login')
    })
  }

  ipcMain.on('session-ready', () => {
    setUpTouchBar()
  })

  ipcMain.on('session-destroyed', () => {
    mainWindow.setTouchBar(null)
  })

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(mainWindow);

  mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    electron.shell.openExternal(url)
  })

  mainWindow.once('ready-to-show', () => {
    applyDefaultZoomPercent({
      webContents: mainWindow.webContents,
      percent: nconf.get('zoom:percent'),
      logger
    })
    mainWindow.show()
    console.timeEnd('init')
    autoUpdater.on('error', data => {
      logger.debug('[autoUpdater] error ' + JSON.stringify(data))
    })
    autoUpdater.on('update-not-available', () => {
      logger.debug('[autoUpdater] update-not-available')
    })
    autoUpdater.on('update-available', (info) => {
      const decision = getUpdateNotificationDecision({
        currentVersion: appInfo.version,
        updateInfo: info
      })

      if (!decision.shouldNotify) {
        logger.debug('[autoUpdater] update notification skipped: ' + decision.reason)
        return
      }

      logger.debug('[autoUpdater] update-available. ' + mainWindow)
      global.newVersionInfo = info
      mainWindow && mainWindow.webContents.send('update-available')
    })

    //Only run auto update checker in production.
    checkForAppUpdates()
  })

  mainWindow.on('minimize', (e) => {
    if (process.platform === 'darwin' && nconf.get('window:minimizeToTray')) {
      e.preventDefault()
      hideWindowToTray(mainWindow)
    }
  })

  mainWindow.on('close', (e) => {
    if (process.platform !== 'darwin') {
      handleNonMacWindowClose(e, mainWindow)
      return
    }

    if (isQuitting) {
      mainWindow = null
      return
    }

    if (nconf.get('window:closeToTray')) {
      e.preventDefault()
      hideWindowToTray(mainWindow)
      return
    }

    if (os.platform() === 'darwin') {
      // Hide the window when users close the window on macOS.
      e.preventDefault()
      mainWindow.hide()
      return
    }

    mainWindow = null
  })

  const ContextMenu = require('electron-context-menu')
  ContextMenu({
    prepend: (params, mainWindow) => []
  })

  mainWindow.loadURL(getRendererUrl())
  setUpApplicationMenu()
  // mainWindow.webContents.openDevTools()

  global.mainWindow = mainWindow
}

app.on('ready', () => {
  applyStartAtLoginSetting({
    app,
    enabled: nconf.get('startAtLogin'),
    logger
  })
  // createWindow()
  applyElectronProxy({
    session: electron.session,
    conf: nconf,
    logger
  }).then(() => {
    checkForAppUpdates({ notify: true })
    createWindowAndAutoLogin()
  })
})

app.on('window-all-closed', () => {
  logger.info('The app window is closed')
  if (process.platform !== 'darwin') app.quit()
  mainWindow = null
})


/* 'before-quit' is emitted when Electron receives 
 * the signal to exit and wants to start closing windows */
app.on('before-quit', (event) => {
  if (process.platform !== 'darwin') {
    if (operationType !== 2) {
      event.preventDefault()
      return
    }
  }

  isQuitting = true
})

// 'activate' is emitted when the user clicks the Dock icon (OS X).
// It is a macOS specific signal mapped to 'applicationShouldHandleReopen' event
app.on('activate', () => mainWindow && mainWindow.show())

function handleNonMacWindowClose (e, win) {
  if (operationType === 0) {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'info',
      title: t('dialog.quitTitle'),
      defaultId: 0,
      cancelId: 0,
      message: t('dialog.quitConfirm'),
      buttons: [t('dialog.neverMind'), t('dialog.minimizeToTray'), t('dialog.quit')]
    })
    if (choice === 1) {
      hideWindowToTray(win)
      e.preventDefault()
      operationType = 1
    } else if (choice === 2) {
      mainWindow = null
      operationType = 2
    } else {
      e.preventDefault()
    }
  }
  if (operationType === 1) {
    hideWindowToTray(win)
    e.preventDefault()
  }
  if (operationType === 2) {
    mainWindow = null
  }
}

function setUpApplicationMenu () {
  // Create the Application's main menu
  let { buildMainMenuTemplate } = require('./app/utilities/menu/mainMenu')
  let gistMenu = {
    label: t('menu.gist'),
    submenu: [
      {
        label: t('menu.newGist'),
        accelerator: shortcuts.keyNewGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('new-gist')
      },
      {
        label: t('menu.editGist'),
        accelerator: shortcuts.keyEditGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('edit-gist')
      },
      {
        label: t('menu.deleteGist'),
        accelerator: shortcuts.keyDeleteGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('delete-gist-check')
      },
      {
        label: t('menu.submitGist'),
        accelerator: shortcuts.keySubmitGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('submit-gist')
      },
      {
        label: t('menu.syncGist'),
        accelerator: shortcuts.keySyncGists,
        click: (item, mainWindow) => mainWindow && mainWindow.send('sync-gists')
      },
      {
        label: t('menu.exitEditor'),
        click: (item, mainWindow) => mainWindow && mainWindow.send('exit-editor')
      },
      {
        label: t('menu.immersiveMode'),
        accelerator: shortcuts.keyImmersiveMode,
        click: (item, mainWindow) => mainWindow && mainWindow.send('immersive-mode')
      },
      {
        label: t('menu.backToNormalMode'),
        accelerator: 'Escape',
        click: (item, mainWindow) => mainWindow && mainWindow.send('back-to-normal-mode')
      },
      {
        label: t('menu.dashboard'),
        accelerator: shortcuts.keyDashboard,
        click: (item, mainWindow) => mainWindow && mainWindow.send('dashboard')
      },
      {
        label: t('menu.about'),
        accelerator: shortcuts.keyAboutPage,
        click: (item, mainWindow) => mainWindow && mainWindow.send('about-page')
      },
      {    
        label: t('menu.search'),
        accelerator: shortcuts.keyShortcutForSearch,
        click: (item, mainWindow) => mainWindow && mainWindow.send('search-gist')
      }
    ]
  }
  let template = [...buildMainMenuTemplate(t), gistMenu]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function setUpBridgeIpcHandlers () {
  const loggerMethods = new Set(['debug', 'error', 'info', 'warn'])
  const appPathNames = new Set(['appData', 'home', 'temp', 'userData'])
  const writableConfigKeys = new Set(['i18n:locale'])

  function isAllowedConfigKey (key) {
    if (typeof key !== 'string' || key.length === 0) return false
    const rootKey = key.split(':')[0]
    return Object.prototype.hasOwnProperty.call(defaultConfig, rootKey)
  }

  function isMainWindowSender (event) {
    return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents
  }

  function loadAccountConfig () {
    try {
      return require('./configs/account')
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error
      return require('./configs/accountDummy')
    }
  }

  function getRendererStorePath (configName) {
    if (typeof configName !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(configName)) {
      return null
    }
    return path.join(app.getPath('userData'), configName + '.json')
  }

  function readRendererStore (configName, defaults = {}) {
    const storePath = getRendererStorePath(configName)
    if (!storePath) return defaults

    try {
      return JSON.parse(fs.readFileSync(storePath))
    } catch (error) {
      return defaults
    }
  }

  function writeRendererStore (configName, data) {
    const storePath = getRendererStorePath(configName)
    if (!storePath) return false

    fs.writeFileSync(storePath, JSON.stringify(data))
    return true
  }

  function getGitHubApiBridge () {
    if (!githubApi) {
      const { createGitHubApi } = require('./app/utilities/githubApi/core')
    githubApi = createGitHubApi({
      conf: nconf,
      gitHubApiBaseUrl: process.env.LEPTON_TEST_GITHUB_API_BASE_URL,
      oauthAccessTokenUrl: process.env.LEPTON_TEST_GITHUB_OAUTH_ACCESS_TOKEN_URL,
      logger
    })
    }
    return githubApi
  }

  function writeConfigValue (key, value) {
    const parts = key.split(':')
    let config = {}
    try {
      config = JSON.parse(fs.readFileSync(global.configFilePath))
    } catch (error) {
      config = {}
    }

    let cursor = config
    parts.slice(0, -1).forEach(part => {
      if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
        cursor[part] = {}
      }
      cursor = cursor[part]
    })
    cursor[parts[parts.length - 1]] = value

    fs.writeFileSync(global.configFilePath, JSON.stringify(config, null, 2))
  }

  ipcMain.on('lepton:config:get', (event, key) => {
    if (!isAllowedConfigKey(key)) {
      logger.warn(`[bridge] Rejected config read for "${key}"`)
      event.returnValue = undefined
      return
    }
    event.returnValue = nconf.get(key)
  })

  ipcMain.handle('lepton:config:set', (event, key, value) => {
    if (!isMainWindowSender(event) || !writableConfigKeys.has(key)) {
      logger.warn(`[bridge] Rejected config write for "${key}"`)
      return undefined
    }

    const persistedValue = key === 'i18n:locale' ? configureI18n(value) : value
    nconf.set(key, persistedValue)
    writeConfigValue(key, persistedValue)
    setUpApplicationMenu()
    if (key !== 'i18n:locale' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload()
    }
    return persistedValue
  })

  ipcMain.on('lepton:account:get', (event) => {
    if (!isMainWindowSender(event)) {
      event.returnValue = {}
      return
    }
    event.returnValue = loadAccountConfig()
  })

  ipcMain.on('lepton:app:get-app-path', (event) => {
    event.returnValue = app.getAppPath()
  })

  ipcMain.on('lepton:app:get-path', (event, name) => {
    if (!appPathNames.has(name)) {
      logger.warn(`[bridge] Rejected app path read for "${name}"`)
      event.returnValue = undefined
      return
    }
    event.returnValue = app.getPath(name)
  })

  ipcMain.on('lepton:paths:get', (event) => {
    event.returnValue = {
      configFilePath: global.configFilePath,
      logFilePath: global.logFilePath
    }
  })

  ipcMain.on('lepton:update-info:get', (event) => {
    event.returnValue = global.newVersionInfo
  })

  ipcMain.handle('lepton:files:ensure-config', (event, defaults = {}) => {
    if (!isMainWindowSender(event)) return false
    if (!fs.existsSync(global.configFilePath)) {
      fs.writeFileSync(global.configFilePath, JSON.stringify(defaults, null, 2))
    }
    return true
  })

  ipcMain.on('lepton:local-storage:get', (event, key) => {
    if (!isMainWindowSender(event) || typeof key !== 'string') {
      event.returnValue = { status: false, data: null }
      return
    }
    event.returnValue = electronLocalStorage.get(key)
  })

  ipcMain.on('lepton:local-storage:set', (event, key, value) => {
    if (!isMainWindowSender(event) || typeof key !== 'string') {
      event.returnValue = { status: false }
      return
    }
    event.returnValue = electronLocalStorage.set(key, value)
  })

  ipcMain.on('lepton:credentials:get-access-token', (event) => {
    if (!isMainWindowSender(event)) {
      event.returnValue = { status: false, data: null }
      return
    }
    event.returnValue = accessTokenStorage.get()
  })

  ipcMain.on('lepton:credentials:set-access-token', (event, token) => {
    if (!isMainWindowSender(event)) {
      event.returnValue = { status: false }
      return
    }
    event.returnValue = accessTokenStorage.set(token)
  })

  ipcMain.on('lepton:renderer-store:get', (event, configName, defaults) => {
    if (!isMainWindowSender(event)) {
      event.returnValue = defaults || {}
      return
    }
    event.returnValue = readRendererStore(configName, defaults)
  })

  ipcMain.on('lepton:renderer-store:set', (event, configName, data) => {
    if (!isMainWindowSender(event)) {
      event.returnValue = false
      return
    }
    event.returnValue = writeRendererStore(configName, data)
  })

  ipcMain.on('lepton:logger:log', (event, method, args = []) => {
    if (!loggerMethods.has(method) || typeof logger[method] !== 'function') return
    logger[method](...args)
  })

  ipcMain.handle('lepton:github-api:request', async (event, selection, args = []) => {
    if (!isMainWindowSender(event) || typeof selection !== 'string' || !Array.isArray(args)) {
      return createGitHubApiBridgeResponse(null, createGitHubApiBridgeError(new Error('Invalid GitHub API bridge request')))
    }

    try {
      const request = getGitHubApiBridge().getGitHubApi(selection)
      if (typeof request !== 'function') {
        throw new Error(`Unsupported GitHub API selection: ${selection}`)
      }

      return createGitHubApiBridgeResponse(await request(...args))
    } catch (error) {
      const serializedError = createGitHubApiBridgeError(error)
      logger.error('[bridge] GitHub API request failed: ' + JSON.stringify(serializedError))
      return createGitHubApiBridgeResponse(null, serializedError)
    }
  })

  ipcMain.on('lepton:notebook:render', (event, content) => {
    if (!isMainWindowSender(event) || typeof content !== 'string') {
      event.returnValue = {
        status: false,
        error: 'Invalid notebook render request'
      }
      return
    }

    try {
      const { renderNotebookContent } = require('./app/utilities/jupyterNotebook/core')
      event.returnValue = {
        status: true,
        html: renderNotebookContent(content)
      }
    } catch (error) {
      event.returnValue = {
        status: false,
        error: error.message
      }
    }
  })

  ipcMain.on('lepton:shell:open-external', (event, url) => {
    if (!isMainWindowSender(event) || typeof url !== 'string') return
    electron.shell.openExternal(url)
  })

  ipcMain.handle('lepton:shell:open-path', (event, filePath) => {
    if (!isMainWindowSender(event) || typeof filePath !== 'string') return ''
    return electron.shell.openPath(filePath)
  })

  ipcMain.on('lepton:window:set-title', (event, title) => {
    if (!isMainWindowSender(event) || typeof title !== 'string') return
    mainWindow.setTitle(title)
  })

  ipcMain.on('lepton:clipboard:write-text', (event, value) => {
    if (!isMainWindowSender(event) || typeof value !== 'string') return
    electron.clipboard.writeText(value)
  })

  ipcMain.handle('lepton:auth:start-github-login', (event, authOptions = {}) => {
    if (!isMainWindowSender(event)) {
      return {
        status: 'error',
        error: 'invalid-sender'
      }
    }

    return startGitHubAuthFlow(authOptions)
  })
}

function startGitHubAuthFlow ({ clientId, scopes } = {}) {
  if (authFlow) {
    logger.debug('[auth] Reusing active GitHub OAuth flow')
    if (authFlow.authWindow && !authFlow.authWindow.isDestroyed()) {
      authFlow.authWindow.focus()
    }
    return authFlow.promise
  }

  if (typeof clientId !== 'string' || clientId.length === 0) {
    logger.warn('[auth] GitHub OAuth flow cannot start: missing client id')
    return Promise.resolve({
      status: 'error',
      error: 'missing-client-id'
    })
  }

  const sandboxAuthWindow = shouldSandboxGitHubOAuthWindow(process.platform)
  const authWindow = new BrowserWindow({
    parent: mainWindow,
    width: 400,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      enableRemoteModule: false,
      contextIsolation: true,
      sandbox: sandboxAuthWindow,
      spellcheck: false
    }
  })

  let resolveAuthFlow
  const promise = new Promise(resolve => {
    resolveAuthFlow = resolve
  })
  authFlow = {
    authWindow,
    promise,
    resolve: resolveAuthFlow
  }

  const authUrl = buildGitHubOAuthUrl({
    authorizeUrl: process.env.LEPTON_TEST_GITHUB_OAUTH_AUTHORIZE_URL,
    clientId,
    scopes
  })
  const options = { extraHeaders: 'pragma: no-cache\n' }

  logger.debug('[auth] Starting GitHub OAuth flow ' + JSON.stringify({
    hasClientId: Boolean(clientId),
    clientIdLength: clientId.length,
    scopeCount: Array.isArray(scopes) ? scopes.length : 0,
    sandbox: sandboxAuthWindow,
    authorizeUrl: describeGitHubOAuthUrl(authUrl)
  }))

  function handleAuthNavigation (event, callbackUrl) {
    const result = parseGitHubOAuthCallback(callbackUrl)
    if (!result) return

    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }

    logger.debug('[auth] OAuth callback parsed: ' + JSON.stringify(describeGitHubAuthResult(result)))
    finishGitHubAuthFlow(result)
  }

  authWindow.webContents.on('will-navigate', (event, callbackUrl) => {
    logger.debug('[auth] OAuth window will-navigate: ' + JSON.stringify(describeGitHubOAuthUrl(callbackUrl)))
    handleAuthNavigation(event, callbackUrl)
  })

  authWindow.webContents.on('will-redirect', (event, callbackUrl) => {
    logger.debug('[auth] OAuth window will-redirect: ' + JSON.stringify(describeGitHubOAuthUrl(callbackUrl)))
    handleAuthNavigation(event, callbackUrl)
  })

  authWindow.webContents.on('did-get-redirect-request', (event, oldUrl, newUrl) => {
    logger.debug('[auth] OAuth window did-get-redirect-request: ' + JSON.stringify({
      from: describeGitHubOAuthUrl(oldUrl),
      to: describeGitHubOAuthUrl(newUrl)
    }))
    handleAuthNavigation(event, newUrl)
  })

  authWindow.webContents.on('did-navigate', (event, callbackUrl) => {
    logger.debug('[auth] OAuth window did-navigate: ' + JSON.stringify(describeGitHubOAuthUrl(callbackUrl)))
    handleAuthNavigation(event, callbackUrl)
  })

  authWindow.webContents.on('did-start-navigation', (event, navigationUrl, isInPlace, isMainFrame) => {
    logger.debug('[auth] OAuth window did-start-navigation: ' + JSON.stringify({
      url: describeGitHubOAuthUrl(navigationUrl),
      isInPlace,
      isMainFrame
    }))
  })

  authWindow.webContents.on('did-finish-load', () => {
    logger.debug('[auth] OAuth window did-finish-load: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))
  })

  authWindow.webContents.on('did-stop-loading', () => {
    logger.debug('[auth] OAuth window did-stop-loading: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))
  })

  authWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('[auth] OAuth window render process gone: ' + JSON.stringify(removeUndefinedProperties({
      reason: details && details.reason,
      exitCode: details && details.exitCode,
      window: describeGitHubAuthWindow(authWindow)
    })))

    if (!authFlow || authFlow.authWindow !== authWindow) {
      if (!authWindow.isDestroyed()) {
        authWindow.destroy()
      }
      return
    }

    finishGitHubAuthFlow({
      status: 'error',
      error: 'renderer-crashed',
      errorDescription: details && details.reason
        ? `OAuth window renderer ${details.reason}`
        : 'OAuth window renderer crashed'
    })
  })

  authWindow.webContents.on('unresponsive', () => {
    logger.warn('[auth] OAuth window webContents became unresponsive: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))
  })

  authWindow.webContents.on('responsive', () => {
    logger.debug('[auth] OAuth window webContents became responsive: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))
  })

  authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    const loadFailure = {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
      currentURL: authWindow.webContents.getURL()
    }

    if (shouldIgnoreGitHubOAuthLoadFailure(loadFailure)) {
      logger.debug('[auth] Ignoring OAuth window load failure: ' + JSON.stringify(describeGitHubOAuthLoadFailure(loadFailure)))
      return
    }

    logger.error('[auth] OAuth window failed to load: ' + JSON.stringify(describeGitHubOAuthLoadFailure(loadFailure)))
    finishGitHubAuthFlow({
      status: 'error',
      error: 'load-failed',
      errorDescription
    }, {
      destroyWindow: false
    })
  })

  authWindow.once('closed', () => {
    if (authFlow && authFlow.authWindow === authWindow) {
      logger.debug('[auth] OAuth window closed before completion: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))
      finishGitHubAuthFlow({
        status: 'closed'
      }, {
        destroyWindow: false
      })
    }
  })

  authWindow.once('ready-to-show', () => {
    logger.debug('[auth] OAuth window ready-to-show: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))
  })

  logger.debug('[auth] OAuth window loadURL start: ' + JSON.stringify({
    target: describeGitHubOAuthUrl(authUrl),
    window: describeGitHubAuthWindow(authWindow)
  }))
  authWindow.loadURL(authUrl, options)
    .then(() => {
      logger.debug('[auth] OAuth window loadURL resolved: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))
    })
    .catch(err => {
      if (!authFlow || authFlow.authWindow !== authWindow) return

      const errorDescription = err && err.message
        ? err.message
        : String(err || 'unknown load failure')
      const loadFailure = {
        errorCode: err && err.code,
        errorDescription,
        validatedURL: authUrl,
        isMainFrame: true
      }
      if (shouldIgnoreGitHubOAuthLoadFailure(loadFailure)) {
        logger.debug('[auth] Ignoring OAuth window load failure: ' + JSON.stringify(describeGitHubOAuthLoadFailure(loadFailure)))
        return
      }

      logger.error('[auth] OAuth window failed to load: ' + JSON.stringify(describeGitHubOAuthLoadFailure(loadFailure)))
      finishGitHubAuthFlow({
        status: 'error',
        error: 'load-failed',
        errorDescription
      }, {
        destroyWindow: false
      })
    })
  authWindow.show()
  logger.debug('[auth] OAuth window show called: ' + JSON.stringify(describeGitHubAuthWindow(authWindow)))

  return promise
}

function finishGitHubAuthFlow (result, options = {}) {
  if (!authFlow) return

  const { authWindow, resolve } = authFlow
  authFlow = null
  logger.debug('[auth] Finishing GitHub OAuth flow: ' + JSON.stringify({
    result: describeGitHubAuthResult(result),
    destroyWindow: options.destroyWindow !== false,
    window: describeGitHubAuthWindow(authWindow)
  }))
  resolve(result)

  if (options.destroyWindow === false || !authWindow || authWindow.isDestroyed()) return

  clearGitHubAuthWindowStorageAndDestroy({ authWindow, logger })
}

function describeGitHubAuthResult (result) {
  if (!result || typeof result !== 'object') {
    return {
      status: 'unknown'
    }
  }

  return removeUndefinedProperties({
    status: result.status,
    hasCode: Boolean(result.code),
    codeLength: result.code ? result.code.length : undefined,
    error: result.error,
    errorDescription: result.errorDescription
  })
}

function describeGitHubOAuthLoadFailure (failure) {
  const validatedURL = failure && failure.validatedURL
  const currentURL = failure && failure.currentURL

  return removeUndefinedProperties({
    errorCode: failure && failure.errorCode,
    errorDescription: failure && failure.errorDescription,
    isMainFrame: failure && failure.isMainFrame,
    failedUrl: describeGitHubOAuthUrl(validatedURL),
    currentUrl: currentURL ? describeGitHubOAuthUrl(currentURL) : undefined
  })
}

function describeGitHubAuthWindow (authWindow) {
  if (!authWindow) {
    return {
      exists: false
    }
  }

  const destroyed = authWindow.isDestroyed()
  if (destroyed) {
    return {
      exists: true,
      destroyed: true
    }
  }

  const webContents = authWindow.webContents
  return removeUndefinedProperties({
    exists: true,
    destroyed: false,
    visible: authWindow.isVisible(),
    focused: authWindow.isFocused(),
    minimized: authWindow.isMinimized(),
    loading: webContents ? webContents.isLoading() : undefined,
    crashed: webContents ? webContents.isCrashed() : undefined,
    currentUrl: webContents ? describeGitHubOAuthUrl(webContents.getURL()) : undefined
  })
}

function createGitHubApiBridgeResponse (data, error) {
  return {
    __leptonGitHubApiBridgeResponse: true,
    ok: !error,
    data,
    error
  }
}

function createGitHubApiBridgeError (error) {
  if (!error || typeof error !== 'object') {
    return {
      message: String(error || 'GitHub API request failed'),
      name: 'Error'
    }
  }

  return removeUndefinedProperties({
    message: error.message || 'GitHub API request failed',
    name: error.name || 'Error',
    status: error.status,
    statusCode: error.statusCode,
    error: cloneSerializableValue(error.error),
    errorDescription: error.errorDescription,
    response: cloneSerializableValue(error.response)
  })
}

function cloneSerializableValue (value) {
  if (value === undefined) return undefined

  try {
    return JSON.parse(JSON.stringify(value))
  } catch (err) {
    return String(value)
  }
}

function removeUndefinedProperties (value) {
  Object.keys(value).forEach(key => {
    if (value[key] === undefined) {
      delete value[key]
    }
  })
  return value
}

function setUpTouchBar() {
  const makeIcon = name => {
    return electron.nativeImage
      .createFromPath(path.join(__dirname, `/build/touchbar/${name}.png`))
      .resize({
        width: 16,
        height: 16
      })
  }
  const { TouchBar } = electron
  const { TouchBarButton, TouchBarSpacer, TouchBarGroup } = TouchBar
  const touchBar = new TouchBar({
    items: [
      new TouchBarButton({
        label: t('touchBar.immersive'),
        icon: makeIcon("immersive"),
        iconPosition: "left",
        click: () => mainWindow.send("immersive-mode")
      }),
      new TouchBarButton({
        label: t('touchBar.sync'),
        icon: makeIcon("sync"),
        iconPosition: "left",
        click: () => mainWindow.send("sync-gists")
      }),
      new TouchBarButton({
        label: t('touchBar.search'),
        icon: makeIcon("search"),
        iconPosition: "left",
        click: () => mainWindow.send("search-gist")
      }),
      new TouchBarSpacer({
        size: "flexible"
      }),
      new TouchBarButton({
        label: t('touchBar.new'),
        icon: makeIcon("new"),
        iconPosition: "left",
        click: () => mainWindow.send("new-gist")
      }),
      new TouchBarButton({
        label: t('touchBar.edit'),
        icon: makeIcon("edit"),
        iconPosition: "left",
        click: () => mainWindow.send("edit-gist")
      })
    ]
  })
  mainWindow.setTouchBar(touchBar)
}

function initGlobalConfigs () {
  const configFilePath = getConfigPath()
  logger.info(`[conf] Looking for .leptonrc at ${configFilePath}`)
  nconf.argv().env()
  try {
    nconf.file({ file: configFilePath })
  } catch (error) {
    logger.error('[.leptonrc] Please correct the mistakes in your configuration file: [%s].\n' + error, configFilePath)
  }
  nconf.defaults(defaultConfig)
  global.conf = nconf
  global.configFilePath = configFilePath
}

function initGlobalLogger () {
  logger.level = nconf.get('logger:level')
  installLoggerRedaction(logger)
  const appFolder = app.getPath('userData')
  if (!fs.existsSync(appFolder)) {
    fs.mkdirSync(appFolder)
  }
  const logFolder = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder)
  }
  const logFile = new Date().toISOString().replace(/:/g, '.') + '.log'
  const logFilePath = path.join(logFolder, logFile)
  logger.add(new winston.transports.File({
    filename: logFilePath
  }))
  global.logger = logger
  global.logFilePath = logFilePath
}

function getTrayIcon () {
  const iconPath = path.join(__dirname, 'build/icon/icon.png')
  if (process.platform !== 'darwin') return iconPath

  const image = electron.nativeImage.createFromPath(
    path.join(__dirname, 'build/icon/tray-flowerTemplate.png')
  )
  if (!image.isEmpty()) {
    image.setTemplateImage(true)
    return image
  }

  const fallbackImage = electron.nativeImage.createFromPath(iconPath).resize({
    width: MACOS_TRAY_ICON_SIZE,
    height: MACOS_TRAY_ICON_SIZE
  })
  fallbackImage.setTemplateImage(true)
  return fallbackImage
}

function showMainWindow (mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function hideWindowToTray (mainWindow) {
  ensureTray(mainWindow)
  mainWindow.hide()
}

function ensureTray (win) {
  if (tray) return tray

  const trayMenuTemplate = [
    {
      label: t('menu.openLeptonWindow'),
      click: () => {
        showMainWindow(win)
      }
    },
    {
      label: t('menu.quitLepton'),
      click: () => {
        operationType = 2
        app.quit()
        if (process.platform !== 'darwin') {
          mainWindow = null
        }
      }
    }
  ]

  tray = new Tray(getTrayIcon())

  const contextMenu = Menu.buildFromTemplate(trayMenuTemplate)

  tray.setToolTip('Lepton')

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    showMainWindow(win)
  })

  return tray
}
