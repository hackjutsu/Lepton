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
    globals: {
      getPaths: unavailableBridgeMethod,
      getUpdateInfo: unavailableBridgeMethod
    },
    ipc: createIpcBridge(),
    logger: {
      debug: () => {},
      error: () => {},
      info: () => {},
      warn: () => {}
    },
    shell: {
      openExternal: unavailableBridgeMethod,
      openPath: unavailableBridgeMethod
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
