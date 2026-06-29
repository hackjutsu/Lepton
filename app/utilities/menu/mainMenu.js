const electron = require('electron')
const app = electron.app || { getName: () => 'Lepton' }

function buildMainMenuTemplate (t) {
  const template = [
    {
      label: t('menu.edit'),
      submenu: [
        {
          role: 'undo'
        },
        {
          role: 'redo'
        },
        {
          type: 'separator'
        },
        {
          role: 'cut'
        },
        {
          role: 'copy'
        },
        {
          role: 'paste'
        },
        {
          role: 'pasteandmatchstyle'
        },
        {
          role: 'delete'
        },
        {
          role: 'selectall'
        }
      ]
    },
    {
      label: t('menu.view'),
      submenu: [
        // {
        //   label: 'Reload',
        //   accelerator: 'CmdOrCtrl+R',
        //   click (item, focusedWindow) {
        //     if (focusedWindow) focusedWindow.reload()
        //   }
        // },
        {
          label: t('menu.toggleDeveloperTools'),
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'resetzoom'
        },
        {
          role: 'zoomin',
          accelerator: 'CmdOrCtrl+='
        },
        {
          role: 'zoomout'
        },
        {
          type: 'separator'
        },
        {
          role: 'togglefullscreen'
        }
      ]
    },
    {
      role: 'window',
      submenu: [
        {
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: t('menu.learnMore'),
          click () { require('electron').shell.openExternal('http://hackjutsu.com/Lepton') }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    const name = app.getName()
    template.unshift({
      label: name,
      submenu: [
        {
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          role: 'hide'
        },
        {
          role: 'hideothers'
        },
        {
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          role: 'quit'
        }
      ]
    })
    // Edit menu.
    template[1].submenu.push(
      {
        type: 'separator'
      },
      {
        label: t('menu.speech'),
        submenu: [
          {
            role: 'startspeaking'
          },
          {
            role: 'stopspeaking'
          }
        ]
      }
    )
    // Window menu.
    template[3].submenu = [
      {
        label: t('menu.close'),
        accelerator: 'CmdOrCtrl+W',
        role: 'close'
      },
      {
        label: t('menu.minimize'),
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
      },
      {
        label: t('menu.zoom'),
        role: 'zoom'
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.bringAllToFront'),
        role: 'front'
      }
    ]
  }

  return template
}

module.exports = {
  buildMainMenuTemplate
}
