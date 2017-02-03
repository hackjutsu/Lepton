'use strict'

const electron = require('electron')
const electronLocalshortcut = require('electron-localshortcut')
const Menu = electron.Menu
const app = electron.app
const BrowserWindow = electron.BrowserWindow

// http://electron.rocks/sharing-between-main-and-renderer-process/
// Set up the logger
const logger = require('winston')
const path = require('path')
const fs = require('fs')

initGlobalLogger()

let mainWindow = null

const keyShortcutForSearch = 'Shift+Space'
const keyNewGist = 'CommandOrControl+N'
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
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    // titleBarStyle: 'hidden',
    backgroundColor: '#808080',
    show: false
  })

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
    createWindow()
})

app.on('window-all-closed', function() {
  logger.info('The app window is closed')
  if (process.platform !== 'darwin') app.quit()
  mainWindow = null
})

app.on('before-quit', function() {
  electronLocalshortcut.unregisterAll(mainWindow)
})

app.on('activate', () => {
  // On macOS, if an app is not fully closed, it is expected to open again
  // when the icon is clicked.
  if (process.platform === 'darwin' && mainWindow === null) {
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
        label: 'Search Gist',
        accelerator: keyShortcutForSearch,
        click: (item, mainWindow) => mainWindow && mainWindow.send('search-gist')
      },
      {
        label: 'Escape',
        accelerator: 'Escape',
        click: (item, mainWindow) => mainWindow && mainWindow.send('key-escape')
      }
    ]
  }
  let template = [...mainMenuTemplate, gistMenu]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function initGlobalLogger () {
  logger.level = 'debug'
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
