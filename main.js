require('@electron/remote/main').initialize()
const os = require('os')
const electron = require('electron')
const nconf = require('nconf')
const windowStateKeeper = require('electron-window-state')
const electronLocalshortcut = require('electron-localshortcut')
const Menu = electron.Menu
const app = electron.app
const dialog = electron.dialog
const Tray = electron.Tray
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

const { autoUpdater } = require("electron-updater")
autoUpdater.logger = logger
autoUpdater.autoDownload = nconf.get('autoUpdate')

initGlobalConfigs()
initGlobalLogger()

logger.info(`\n\n----- ${appInfo.name} v${appInfo.version} ${os.platform()}-----\n`)

logger.info(`[conf] Looking for .leptonrc at ${getConfigPath()}`)
logger.info('[conf] The resolved configuration is ...')
for (const key of Object.getOwnPropertyNames(defaultConfig)) {
  logger.info(`"${key}": ${JSON.stringify(nconf.get(key))}`)    
}

let mainWindow = null
let miniWindow = null
let operationType = 0;

const shortcuts = nconf.get('shortcuts')

function getConfigPath() {
  if (process && process.env && process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, '.leptonrc'
  } else {
    return path.join(app.getPath('home'), '.leptonrc')
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
    nodeIntegration: true,
    enableRemoteModule: true,
    // https://github.com/electron/electron/blob/main/docs/tutorial/context-isolation.md
    // TODO: migrate and enable context isolation
    contextIsolation: false
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
    icon: path.join(__dirname, '/icon/icon.png'),
    webPreferences
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
    mainWindow.show()
    console.timeEnd('init')
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

    //Only run auto update checker in production.
    if (!isDev && !appInfo.version.includes('alpha')) {
        autoUpdater.checkForUpdates()
    }
  })

  mainWindow.on('close', (e) => {
    if (operationType == 0) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'info',
        title: 'Quit',
        defaultId: 0,
        cancelId: 0,
        message: 'Are you sure?',
        buttons: ['Nerver Mind', 'Minimize to disk', 'Quit']
      })
      if (choice === 1) {
        if (miniWindow) {
          mainWindow.hide() // 调用 最小化实例方法
        } else {
          setTray(app, mainWindow)
        }
        e.preventDefault()
        operationType = 1
      } else if (choice === 2) {
        if (os.platform() === 'darwin' && !willQuitApp) {
          // Hide the window when users close the window on macOS
          e.preventDefault()
          mainWindow.hide()
        } else {
          mainWindow = null
        }
        operationType = 2
      } else {
        e.preventDefault()
      }
    }
    if (operationType == 1) {
      if (miniWindow) {
        mainWindow.hide() // 调用 最小化实例方法
      } else {
        setTray(app, mainWindow)
      }
      e.preventDefault()
    }
    if (operationType == 2) {
      if (os.platform() === 'darwin' && !willQuitApp) {
        // Hide the window when users close the window on macOS
        e.preventDefault()
        mainWindow.hide()
      } else {
        mainWindow = null
      }
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
app.on('before-quit', (event) => {
  if (operationType == 2) {
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
  }else{
    event.preventDefault()
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
        accelerator: shortcuts.keyNewGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('new-gist')
      },
      {
        label: 'Edit Gist',
        accelerator: shortcuts.keyEditGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('edit-gist')
      },
      {
        label: 'Delete Gist',
        accelerator: shortcuts.keyDeleteGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('delete-gist-check')
      },
      {
        label: 'Submit Gist',
        accelerator: shortcuts.keySubmitGist,
        click: (item, mainWindow) => mainWindow && mainWindow.send('submit-gist')
      },
      {
        label: 'Sync Gist',
        accelerator: shortcuts.keySyncGists,
        click: (item, mainWindow) => mainWindow && mainWindow.send('sync-gists')
      },
      {
        label: 'Exit Editor',
        accelerator: shortcuts.keyEditorExit,
        click: (item, mainWindow) => mainWindow && mainWindow.send('exit-editor')
      },
      {
        label: 'Immersive Mode',
        accelerator: shortcuts.keyImmersiveMode,
        click: (item, mainWindow) => mainWindow && mainWindow.send('immersive-mode')
      },
      {
        label: 'Back to Normal Mode',
        accelerator: 'Escape',
        click: (item, mainWindow) => mainWindow && mainWindow.send('back-to-normal-mode')
      },
      {
        label: 'Dashboard',
        accelerator: shortcuts.keyDashboard,
        click: (item, mainWindow) => mainWindow && mainWindow.send('dashboard')
      },
      {
        label: 'About',
        accelerator: shortcuts.keyAboutPage,
        click: (item, mainWindow) => mainWindow && mainWindow.send('about-page')
      },
      {    
        label: 'Search',
        accelerator: shortcuts.keyShortcutForSearch,
        click: (item, mainWindow) => mainWindow && mainWindow.send('search-gist')
      }
    ]
  }
  let template = [...mainMenuTemplate, gistMenu]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
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
        label: "Immersive",
        icon: makeIcon("immersive"),
        iconPosition: "left",
        click: () => mainWindow.send("immersive-mode")
      }),
      new TouchBarButton({
        label: "Sync",
        icon: makeIcon("sync"),
        iconPosition: "left",
        click: () => mainWindow.send("sync-gists")
      }),
      new TouchBarButton({
        label: "Search",
        icon: makeIcon("search"),
        iconPosition: "left",
        click: () => mainWindow.send("search-gist")
      }),
      new TouchBarSpacer({
        size: "flexible"
      }),
      new TouchBarButton({
        label: "New",
        icon: makeIcon("new"),
        iconPosition: "left",
        click: () => mainWindow.send("new-gist")
      }),
      new TouchBarButton({
        label: "Edit",
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
  logger.add(logger.transports.File, {
      json: false,
      exitOnError: false,
      filename: logFilePath,
      timestamp: true })
  global.logger = logger
  global.logFilePath = logFilePath
}

function setTray(app, mainWindow) {
  if (miniWindow) {
    mainWindow.hide()
    return
  }
  const trayMenuTemplate = [
    {
      label: 'Open Window',
      click: () => {
        mainWindow.show()
      }
    },
    {
      label: 'Quit',
      click: () => {
        operationType = 2
        if (process.platform !== 'darwin') app.quit()
        mainWindow = null
      }
    }
  ]
  const iconPath = path.join(__dirname, 'build/icon/icon.png')

  miniWindow = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate(trayMenuTemplate)

  mainWindow.hide()

  miniWindow.setToolTip('Lepton')

  miniWindow.setContextMenu(contextMenu)

  miniWindow.on('double-click', () => {
    mainWindow.show()
  })
  return miniWindow
}
