const { contextBridge, ipcRenderer } = require('electron')

const LOG_METHODS = ['debug', 'error', 'info', 'warn']

function serializeLogArg (arg) {
  if (arg instanceof Error) {
    const serialized = {
      message: arg.message,
      name: arg.name,
      stack: arg.stack
    }
    Object.keys(arg).forEach(key => {
      serialized[key] = arg[key]
    })
    return serialized
  }
  return arg
}

function sendLog (method, args) {
  ipcRenderer.send('lepton:logger:log', method, Array.from(args).map(serializeLogArg))
}

const leptonApi = {
  account: {
    get: () => ipcRenderer.sendSync('lepton:account:get')
  },
  app: {
    getAppPath: () => ipcRenderer.sendSync('lepton:app:get-app-path'),
    getPath: (name) => ipcRenderer.sendSync('lepton:app:get-path', name)
  },
  auth: {
    startGitHubLogin: (options) => ipcRenderer.invoke('lepton:auth:start-github-login', options)
  },
  clipboard: {
    writeText: (value) => ipcRenderer.send('lepton:clipboard:write-text', value)
  },
  config: {
    get: (key) => ipcRenderer.sendSync('lepton:config:get', key),
    set: (key, value) => ipcRenderer.invoke('lepton:config:set', key, value)
  },
  files: {
    ensureConfigFile: (defaults) => ipcRenderer.invoke('lepton:files:ensure-config', defaults)
  },
  globals: {
    getUpdateInfo: () => ipcRenderer.sendSync('lepton:update-info:get'),
    getPaths: () => ipcRenderer.sendSync('lepton:paths:get')
  },
  github: {
    request: (selection, args) => ipcRenderer.invoke('lepton:github-api:request', selection, args)
  },
  ipc: {
    emit: (channel, ...args) => ipcRenderer.emit(channel, ...args),
    on: (channel, listener) => {
      const wrapped = (event, ...args) => listener(...args)
      ipcRenderer.on(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args)
  },
  logger: LOG_METHODS.reduce((api, method) => {
    api[method] = (...args) => sendLog(method, args)
    return api
  }, {}),
  localStorage: {
    get: (key) => ipcRenderer.sendSync('lepton:local-storage:get', key),
    set: (key, value) => ipcRenderer.sendSync('lepton:local-storage:set', key, value)
  },
  notebook: {
    render: (content) => ipcRenderer.sendSync('lepton:notebook:render', content)
  },
  shell: {
    openExternal: (url) => ipcRenderer.send('lepton:shell:open-external', url),
    openPath: (filePath) => ipcRenderer.invoke('lepton:shell:open-path', filePath)
  },
  store: {
    get: (configName, defaults) => ipcRenderer.sendSync('lepton:renderer-store:get', configName, defaults),
    set: (configName, data) => ipcRenderer.sendSync('lepton:renderer-store:set', configName, data)
  },
  window: {
    setTitle: (title) => ipcRenderer.send('lepton:window:set-title', title)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('lepton', leptonApi)
} else {
  window.lepton = leptonApi
}
