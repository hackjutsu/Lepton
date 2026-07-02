function createIpcBridge () {
  return {
    emit: () => {},
    on: () => () => {},
    removeAllListeners: () => {},
    send: () => {}
  }
}

function unavailableBridgeMethod () {
  throw new Error('Electron bridge is unavailable. Renderer code must use the preload bridge.')
}

function createUnavailableBridge () {
  return {
    account: {
      get: unavailableBridgeMethod
    },
    app: {
      getAppPath: unavailableBridgeMethod,
      getPath: unavailableBridgeMethod
    },
    auth: {
      startGitHubLogin: unavailableBridgeMethod
    },
    clipboard: {
      writeText: unavailableBridgeMethod
    },
    config: {
      get: unavailableBridgeMethod,
      set: unavailableBridgeMethod
    },
    credentials: {
      getAccessToken: unavailableBridgeMethod,
      setAccessToken: unavailableBridgeMethod
    },
    files: {
      ensureConfigFile: unavailableBridgeMethod
    },
    globals: {
      getPaths: unavailableBridgeMethod,
      getUpdateInfo: unavailableBridgeMethod
    },
    github: {
      request: unavailableBridgeMethod
    },
    ipc: createIpcBridge(),
    logger: {
      debug: () => {},
      error: () => {},
      info: () => {},
      warn: () => {}
    },
    localStorage: {
      get: unavailableBridgeMethod,
      set: unavailableBridgeMethod
    },
    notebook: {
      render: unavailableBridgeMethod
    },
    shell: {
      openExternal: unavailableBridgeMethod,
      openPath: unavailableBridgeMethod
    },
    store: {
      get: unavailableBridgeMethod,
      set: unavailableBridgeMethod
    },
    window: {
      setTitle: unavailableBridgeMethod
    }
  }
}

const bridge = typeof window !== 'undefined' && window.lepton
  ? window.lepton
  : createUnavailableBridge()

export default bridge
