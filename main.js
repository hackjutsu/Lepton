'use strict'

const os = require('os')
const electron = require('electron')
const nconf = require('nconf')
const windowStateKeeper = require('electron-window-state')
const electronLocalshortcut = require('electron-localshortcut')
const Menu = electron.Menu
const app = electron.app
const ipcMain = electron.ipcMain
const BrowserWindow = electron.BrowserWindow
let willQuitApp = false

// http://electron.rocks/sharing-between-main-and-renderer-process/
// Set up the logger
const logger = require('winston')
const path = require('path')
const fs = require('fs')
const isDev = require('electron-is-dev')
const defaultConfig = require('./configs/defaultConfig')
const appInfo = require('./package.json')

const autoUpdater = require('electron-updater').autoUpdater
autoUpdater.logger = logger
autoUpdater.autoDownload = true

initGlobalConfigs()
initGlobalLogger()

logger.info(`\n\n----- ${appInfo.name} v${appInfo.version} ${os.platform()}-----\n`)

logger.info(`[conf] Looking for .leptonrc at ${ app.getPath('home') + '/.leptonrc' }`)
logger.info('[conf] The resolved configuration is ...')
for (const key of Object.getOwnPropertyNames(defaultConfig)) {
  logger.info(`"${key}": ${JSON.stringify(nconf.get(key))}`)    
}

let mainWindow = null

const keyShortcutForSearch = 'Shift+Space'
const keyNewGist = 'CommandOrControl+N'
const keyEditGist = 'CommandOrControl+E'
const keySubmitGist = 'CommandOrControl+S'
const keyImmersiveMode = 'CommandOrControl+I'
const keyAboutPage = 'CommandOrControl+,'
const keyDashboard = 'CommandOrControl+D'
const keyEditorExit = 'CommandOrControl+Escape'
const keySyncGists = 'CommandOrControl+R'

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

  mainWindow = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    minWidth: 1000,
    minHeight: 700,
    // titleBarStyle: 'hidden',
    backgroundColor: '#808080',
    show: false,
    icon: path.join(__dirname, '/icon/icon.png')
  })

  if (autoLogin) {
    logger.debug('-----> registering login-page-ready listener')
    // Set up a one-time listener for 'login-page-ready'
    ipcMain.on('login-page-ready', () => {
      logger.info('[signal] sending auto-login signal')        
      mainWindow.webContents.send('auto-login')
      ipcMain.removeAllListeners('login-page-ready')
    })
  }

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(mainWindow);

  mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    electron.shell.openExternal(url)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    console.timeEnd('init')
    // autoUpdater.on('error', data => {
    //   logger.debug('[autoUpdater] error ' + JSON.stringify(data))
    // })
    // autoUpdater.on('update-not-available', () => {
    //   logger.debug('[autoUpdater] update-not-available')
    // })
    // autoUpdater.on('update-available', (info) => {
    //   logger.debug('[autoUpdater] update-available. ' + mainWindow)
    //   global.newVersionInfo = info
    //   mainWindow && mainWindow.webContents.send('update-available')
    // })

    // Only run auto update checker in production.
    // if (!isDev && !appInfo.version.includes('alpha')) {
    //     autoUpdater.checkForUpdates()
    // }
  })

  mainWindow.on('close', (e) => {
    if (os.platform() === 'darwin' && !willQuitApp) {
      // Hide the window when users close the window on macOS
      e.preventDefault()
      mainWindow.hide()
    } else {
      mainWindow = null
    }
  });

  const ContextMenu = require('electron-context-menu')
  ContextMenu({
    prepend: (params, mainWindow) => []
  })

  mainWindow.loadURL(`file://${__dirname}/index.html`)
  setUpApplicationMenu()
  // mainWindow.webContents.openDevTools()

  global.mainWindow = mainWindow
}

app.on('ready', () => {
    // createWindow()
    autoUpdater.checkForUpdatesAndNotify()
    createWindowAndAutoLogin()
})

app.on('window-all-closed', () => {
  logger.info('The app window is closed')
  if (process.platform !== 'darwin') app.quit()
  mainWindow = null
})


/* 'before-quit' is emitted when Electron receives 
 * the signal to exit and wants to start closing windows */
app.on('before-quit', () => {
  willQuitApp = true
  try {
    // If we launch the app and close it quickly, we might run into a 
    // situation where electronLocalshortcut is not initialized.
    if (mainWindow && electronLocalshortcut) {
      electronLocalshortcut.unregisterAll(mainWindow)
    }
  } catch (e) {
    logger.error(e)
  }
})

// 'activate' is emitted when the user clicks the Dock icon (OS X).
// It is a macOS specific signal mapped to 'applicationShouldHandleReopen' event
app.on('activate', () => mainWindow && mainWindow.show())

function setUpApplicationMenu () {
  // Create the Application's main menu
  let { mainMenuTemplate } = require('./app/utilities/menu/mainMenu')
  let gistMenu = {
    label: 'Gist',
    submenu: [
      {
        label: 'New Gist',
        accelerator: keyNewGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('new-gist')
      },
      {
        label: 'Edit Gist',
        accelerator: keyEditGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('edit-gist')
      },
      {
        label: 'Submit Gist',
        accelerator: keySubmitGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('submit-gist')
      },
      {
        label: 'Sync Gist',
        accelerator: keySyncGists,
        click: (item, mainWindow) => mainWindow && mainWindow.send('sync-gists')
      },
      {
        label: 'Exit Editor',
        accelerator: keyEditorExit,
        click: (item, mainWindow) => mainWindow && mainWindow.send('exit-editor')
      },
      {
        label: 'Immersive Mode',
        accelerator: keyImmersiveMode,
        click: (item, mainWindow) => mainWindow && mainWindow.send('immersive-mode')
      },
      {
        label: 'Back to Normal Mode',
        accelerator: 'Escape',
        click: (item, mainWindow) => mainWindow && mainWindow.send('back-to-normal-mode')
      },
      {
        label: 'Dashboard',
        accelerator: keyDashboard,
        click: (item, mainWindow) => mainWindow && mainWindow.send('dashboard')
      },
      {
        label: 'About',
        accelerator: keyAboutPage,
        click: (item, mainWindow) => mainWindow && mainWindow.send('about-page')
      },
      {    
        label: 'Search',
        accelerator: keyShortcutForSearch,
        click: (item, mainWindow) => mainWindow && mainWindow.send('search-gist')
      }
    ]
  }
  let template = [...mainMenuTemplate, gistMenu]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function initGlobalConfigs () {
  const configFilePath = app.getPath('home') + '/.leptonrc'
  logger.info(`[conf] Looking for .leptonrc at ${configFilePath}`)
  nconf.argv().env()
  try {
    nconf.file({ file: configFilePath })
  } catch (error) {
    logger.error('[.leptonrc] Please correct the mistakes in your configuration file: [%s].\n' + error, configFilePath)
  }

  nconf.defaults(defaultConfig)  
  global.conf = nconf
}

function initGlobalLogger () {
  logger.level = nconf.get('logger:level')
  let appFolder = app.getPath('userData')
  if (!fs.existsSync(appFolder)) {
    fs.mkdirSync(appFolder)
  }
  let logFolder = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder)
  }
  let logFile = new Date().toISOString().replace(/:/g, '.') + '.log'
  logger.add(logger.transports.File, {
      json: false,
      exitOnError: false,
      filename: path.join(logFolder, logFile),
      timestamp: true })
  global.logger = logger
}
