import { describe, expect, it, vi } from 'vitest'
import githubAuthWindow from '../../app/utilities/auth/githubAuthWindow'

const {
  clearGitHubAuthWindowStorageAndDestroy
} = githubAuthWindow

function createLogger () {
  return {
    debug: vi.fn(),
    warn: vi.fn()
  }
}

function createAuthWindow ({
  clearStorageData = () => Promise.resolve(),
  destroyed = false
} = {}) {
  const state = {
    destroyed
  }
  return {
    destroy: vi.fn(() => {
      state.destroyed = true
    }),
    isDestroyed: vi.fn(() => state.destroyed),
    webContents: {
      session: {
        clearStorageData: vi.fn(clearStorageData)
      }
    }
  }
}

describe('GitHub auth window cleanup', () => {
  it('waits for Electron 42 Promise-based storage clearing before destroying the auth window', async () => {
    const authWindow = createAuthWindow({
      clearStorageData: () => Promise.resolve()
    })
    const logger = createLogger()

    await clearGitHubAuthWindowStorageAndDestroy({ authWindow, logger })

    expect(authWindow.webContents.session.clearStorageData).toHaveBeenCalledWith({})
    expect(logger.debug).toHaveBeenCalledWith('[auth] OAuth session storage cleared')
    expect(logger.debug).toHaveBeenCalledWith('[auth] Destroying OAuth auth window')
    expect(authWindow.destroy).toHaveBeenCalledTimes(1)
  })

  it('still destroys the auth window when Promise-based storage clearing rejects', async () => {
    const authWindow = createAuthWindow({
      clearStorageData: () => Promise.reject(new Error('clear failed'))
    })
    const logger = createLogger()

    await clearGitHubAuthWindowStorageAndDestroy({ authWindow, logger })

    expect(logger.warn).toHaveBeenCalledWith('[auth] Failed to clear OAuth session data: clear failed')
    expect(authWindow.destroy).toHaveBeenCalledTimes(1)
  })

  it('destroys the auth window for legacy synchronous storage clearing behavior', async () => {
    const authWindow = createAuthWindow({
      clearStorageData: () => undefined
    })
    const logger = createLogger()

    await clearGitHubAuthWindowStorageAndDestroy({ authWindow, logger })

    expect(logger.debug).toHaveBeenCalledWith('[auth] OAuth session storage clear requested')
    expect(authWindow.destroy).toHaveBeenCalledTimes(1)
  })

  it('does not clear storage or destroy an already destroyed auth window', async () => {
    const authWindow = createAuthWindow({
      destroyed: true
    })
    const logger = createLogger()

    await clearGitHubAuthWindowStorageAndDestroy({ authWindow, logger })

    expect(authWindow.webContents.session.clearStorageData).not.toHaveBeenCalled()
    expect(authWindow.destroy).not.toHaveBeenCalled()
  })
})
