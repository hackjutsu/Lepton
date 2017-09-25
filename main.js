'use strict'

const electron = require('electron')
const nconf = require('nconf')
const windowStateKeeper = require('electron-window-state')
const electronLocalshortcut = require('electron-localshortcut')
const Menu = electron.Menu
const app = electron.app
const BrowserWindow = electron.BrowserWindow

// http://electron.rocks/sharing-between-main-and-renderer-process/
// Set up the logger
const logger = require('winston')
const path = require('path')
const fs = require('fs')
const isDev = require('electron-is-dev')

const autoUpdater = require("electron-updater").autoUpdater
autoUpdater.logger = logger
autoUpdater.autoDownload = false

initGlobalConfigs()
initGlobalLogger()

let mainWindow = null

const keyShortcutForSearch = 'Shift+Space'
const keyNewGist = 'CommandOrControl+N'
const keyEditGist = 'CommandOrControl+E'
const keyImmersiveMode = 'CommandOrControl+I'
const keyPreference = 'CommandOrControl+,'
const keyUp = 'Shift+Up'
const keyDown = 'Shift+Down'
const keyEnter = 'Shift+Enter'

function createWindowAndAutoLogin () {
  createWindow()
  mainWindow.on('show', () => {
    mainWindow.webContents.send('auto-login')
  })
}

function createWindow () {
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
    show: false
  })

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(mainWindow);

  mainWindow.webContents.on('will-navigate', function(e, url) {
    e.preventDefault()
    electron.shell.openExternal(url)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    console.timeEnd('init')
    electronLocalshortcut.register(mainWindow, keyUp, () => {
    //   console.log('You pressed ' + keyUp)
      mainWindow && mainWindow.webContents.send('key-up')
    })
    electronLocalshortcut.register(mainWindow, keyDown, () => {
    //   console.log('You pressed ' + keyDown)
      mainWindow && mainWindow.webContents.send('key-down')
    })
    electronLocalshortcut.register(mainWindow, keyEnter, () => {
    //   console.log('You pressed ' + keyEnter)
      mainWindow && mainWindow.webContents.send('key-enter')
    })
    autoUpdater.on('error', data => {
      logger.debug('[autoUpdater] error ' + JSON.stringify(data))
    })
    autoUpdater.on('update-not-available', () => {
      logger.debug('[autoUpdater] update-not-available')
    })
    autoUpdater.on('update-available', (info) => {
      logger.debug('[autoUpdater] update-available. ' + mainWindow)
      global.newVersionInfo = info
      mainWindow && mainWindow.webContents.send('update-available')
    })

    // Only run auto update checker in production.
    if (!isDev) {
        autoUpdater.checkForUpdates()
    }
  })

  const ContextMenu = require('electron-context-menu')
  ContextMenu({
    prepend: (params, mainWindow) => []
  })

  mainWindow.loadURL(`file://${__dirname}/index.html`)
  setUpApplicationMenu()
  // mainWindow.webContents.openDevTools()

  global.mainWindow = mainWindow
}

app.on('ready', function() {
    // createWindow()
    createWindowAndAutoLogin()
})

app.on('window-all-closed', function() {
  logger.info('The app window is closed')
  if (process.platform !== 'darwin') app.quit()
  mainWindow = null
})

app.on('before-quit', function() {
  if (mainWindow) {
    electronLocalshortcut.unregisterAll(mainWindow)
  }
})

// 'activate' is a macOS specific signal mapped to 
// 'applicationShouldHandleReopen' event
app.on('activate', (event, hasVisibleWindows) => {
  // On macOS, if an app is not fully closed, it is expected to open again
  // when the icon is clicked.
  if (mainWindow === null && !hasVisibleWindows && app.isReady()) {
    createWindowAndAutoLogin()
  }
})

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
        label: 'Search Gist',
        accelerator: keyShortcutForSearch,
        click: (item, mainWindow) => mainWindow && mainWindow.send('search-gist')
      },
      {
        label: 'Immersive Mode',
        accelerator: keyImmersiveMode,
        click: (item, mainWindow) => mainWindow && mainWindow.send('immersive-mode')
      },
      {
        label: 'Back to Normal Mode',
        accelerator: 'Escape',
        click: (item, mainWindow) => {
          mainWindow && mainWindow.send('back-to-normal-mode')
        }
      },
      {
        label: 'About',
        accelerator: keyPreference,
        click: (item, mainWindow) => {
          mainWindow && mainWindow.send('local-preference')
        }
      }
    ]
  }
  let template = [...mainMenuTemplate, gistMenu]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function initGlobalConfigs () {
  const configFilePath = app.getPath('home') + '/.leptonrc'
  let conf = null
  try {
    conf = nconf.argv()
      .env()
      .file({ file: configFilePath })
  } catch (error) {
    logger.error('[.leptonrc] Please correct the mistakes in your configuration file: [%s].\n' + error, configFilePath)
  }
  global.conf = conf
}

function initGlobalLogger () {
  logger.level = 'info'
  if (global.conf && global.conf.get('logger:level')) {
    const level = global.conf.get('logger:level')
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
      logger.info('[.leptonrc] Overwriting logger level to ' + level)
      logger.level = level 
    } else {
      logger.warn('[.leptonrc] Failed to overwrite the default logger level(info).' +  
        ' The logger:level should be [debug|info|warn|error].')
    }
  }
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
