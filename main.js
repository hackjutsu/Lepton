'use strict'

const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

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
  mainWindow.webContents.openDevTools()
})

app.on('window-all-closed', function() {
  console.log('Clearing the cache for the main window...')
  mainWindow.webContents.session.clearStorageData([], () => {})
  if (process.platform !== "darwin") app.quit();
})

app.on('before-quit', function() {

});
