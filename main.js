'use strict'

const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

// http://electron.rocks/sharing-between-main-and-renderer-process/
// Set up the logger
const logger = require('winston')
const path = require('path')
const fs = require('fs')

initGlobalLogger()

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 1000,
      minHeight: 700,
      titleBarStyle: 'hidden'
  })
  mainWindow.loadURL(`file://${__dirname}/index.html`)
  // mainWindow.webContents.openDevTools()
})

app.on('window-all-closed', function() {
  logger.info('The app window is closed')
  // mainWindow.webContents.session.clearStorageData([
  //     'appcache',
  //     'cookies',
  //     'indexdb',
  //     'shadercache',
  //     'websql',
  //     'serviceworkers',
  //   ], () => {})
  if (process.platform !== "darwin") app.quit()
})

app.on('before-quit', function() {

})

function initGlobalLogger () {
  logger.level = 'debug'
  let logFolder = path.join(app.getPath("userData"), "logs")
  let logFile = new Date().toISOString().replace(/:/g, '.') + '.log'
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder);
  }
  logger.add(logger.transports.File, {
      json: false,
      exitOnError: false,
      filename: path.join(logFolder, logFile),
      timestamp: true })
  global.logger = logger
}
