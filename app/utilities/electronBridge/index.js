function createIpcBridge (ipcRenderer) {
  if (!ipcRenderer) {
    return {
      emit: () => {},
      on: () => () => {},
      removeAllListeners: () => {},
      send: () => {}
    }
  }

  return {
    emit: (channel, ...args) => ipcRenderer.emit(channel, ...args),
    on: (channel, listener) => {
      const wrapped = (event, ...args) => listener(...args)
      ipcRenderer.on(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args)
  }
}

function createFallbackBridge () {
  const electron = require('electron')
  const remote = electron.remote || require('@electron/remote')
  const conf = remote.getGlobal('conf')
  const logger = remote.getGlobal('logger')
  const app = electron.app || remote.app

  return {
    app: {
      getAppPath: () => app.getAppPath(),
      getPath: (name) => app.getPath(name)
    },
    clipboard: electron.clipboard || { writeText: () => {} },
    config: {
      get: (key) => conf.get(key)
    },
    globals: {
      getPaths: () => ({
        configFilePath: remote.getGlobal('configFilePath'),
        logFilePath: remote.getGlobal('logFilePath')
      }),
      getUpdateInfo: () => remote.getGlobal('newVersionInfo')
    },
    ipc: createIpcBridge(electron.ipcRenderer),
    logger,
    shell: electron.shell || {
      openExternal: () => {},
      openPath: () => {}
    },
    window: {
      setTitle: (title) => remote.getCurrentWindow().setTitle(title)
    }
  }
}

const bridge = typeof window !== 'undefined' && window.lepton
  ? window.lepton
  : createFallbackBridge()

export default bridge
