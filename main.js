'use strict'

const electron = require('electron')
const electronLocalshortcut = require('electron-localshortcut');
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

let keyShortcutForSearch1 = 'Shift+Space'
let keyShortcutForSearch2 = 'CommandOrControl+F'
let keyNewGist = 'CommandOrControl+N'
let keyUp = 'Shift+Up'
let keyDown = 'Shift+Down'
let keyEnter = 'Shift+Enter'

function createWindow () {
  console.time('init')
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hidden',
    backgroundColor: '#808080',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    console.timeEnd('init')
    electronLocalshortcut.register(mainWindow, keyShortcutForSearch1, () => {
    //   console.log('You pressed ' + keyShortcutForSearch1)
      mainWindow && mainWindow.webContents.send('search-gist')
    })
    electronLocalshortcut.register(mainWindow, keyShortcutForSearch2, () => {
    //   console.log('You pressed ' + keyShortcutForSearch2)
      mainWindow && mainWindow.webContents.send('search-gist')
    })
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
    electronLocalshortcut.register(mainWindow, keyNewGist, () => {
    //   console.log('You pressed ' + keyNewGist)
      mainWindow && mainWindow.webContents.send('new-gist')
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
    createWindow()
  }
})

function setUpApplicationMenu () {
  // Create the Application's main menu
  let template = [{
    label: "Application",
    submenu: [
      { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
      { type: "separator" },
      { label: "Quit", accelerator: "Command+Q", click: function() { app.quit() }}
    ]}, {
    label: "Edit",
    submenu: [
      { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
      { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
      { type: "separator" },
      { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
    ]}
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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
