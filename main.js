'use strict'

const electron = require('electron')

const app = electron.app,
  BrowserWindow = electron.BrowserWindow

let mainWindow = null

app.on('window-all-closed', ()=> {
  app.quit()
})

app.on('ready', ()=> {

  const win = {
    width: 800,
    height: 600
  }

  mainWindow = new BrowserWindow(win)

  mainWindow.loadURL(`file://${__dirname}/index.html`)

  mainWindow.webContents.openDevTools()

  mainWindow.on('closed', ()=> {
    mainWindow = null
  })
})
