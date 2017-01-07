'use strict'

const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

let mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 900,
      minHeight: 700,
      titleBarStyle: 'hidden'
  })
  mainWindow.loadURL(`file://${__dirname}/index.html`)
  // mainWindow.webContents.openDevTools()
})
