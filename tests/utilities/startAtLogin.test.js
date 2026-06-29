import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const {
  applyStartAtLoginSetting,
  isStartAtLoginSupported,
  normalizeStartAtLoginValue
} = require('../../app/utilities/startAtLogin')

function createLogger () {
  return {
    info: vi.fn(),
    warn: vi.fn()
  }
}

describe('start at login utility', () => {
  it('supports Electron login items on macOS and Windows', () => {
    expect(isStartAtLoginSupported('darwin')).toBe(true)
    expect(isStartAtLoginSupported('win32')).toBe(true)
    expect(isStartAtLoginSupported('linux')).toBe(false)
  })

  it('applies the configured login item setting', () => {
    const app = {
      getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
      setLoginItemSettings: vi.fn()
    }
    const logger = createLogger()

    const result = applyStartAtLoginSetting({
      app,
      enabled: true,
      logger,
      platform: 'win32'
    })

    expect(result).toBe(true)
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true
    })
    expect(logger.info).toHaveBeenCalledWith('[startup] startAtLogin enabled')
  })

  it('removes the login item when disabled', () => {
    const app = {
      getLoginItemSettings: vi.fn(() => ({ openAtLogin: true })),
      setLoginItemSettings: vi.fn()
    }

    applyStartAtLoginSetting({
      app,
      enabled: false,
      logger: createLogger(),
      platform: 'darwin'
    })

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false
    })
  })

  it('skips redundant login item writes when already disabled', () => {
    const app = {
      getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
      setLoginItemSettings: vi.fn()
    }
    const logger = createLogger()

    const result = applyStartAtLoginSetting({
      app,
      enabled: false,
      logger,
      platform: 'darwin'
    })

    expect(result).toBe(true)
    expect(app.setLoginItemSettings).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('[startup] startAtLogin already disabled')
  })

  it('skips unsupported platforms', () => {
    const app = {
      setLoginItemSettings: vi.fn()
    }
    const logger = createLogger()

    const result = applyStartAtLoginSetting({
      app,
      enabled: true,
      logger,
      platform: 'linux'
    })

    expect(result).toBe(false)
    expect(app.setLoginItemSettings).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('[startup] startAtLogin is not supported on linux')
  })

  it('quietly skips unsupported platforms when disabled', () => {
    const app = {
      setLoginItemSettings: vi.fn()
    }
    const logger = createLogger()

    const result = applyStartAtLoginSetting({
      app,
      enabled: false,
      logger,
      platform: 'linux'
    })

    expect(result).toBe(false)
    expect(app.setLoginItemSettings).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('skips unavailable Electron login item APIs', () => {
    const logger = createLogger()

    const result = applyStartAtLoginSetting({
      app: {},
      enabled: true,
      logger,
      platform: 'win32'
    })

    expect(result).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith('[startup] app.setLoginItemSettings is unavailable')
  })

  it('normalizes string config values safely', () => {
    expect(normalizeStartAtLoginValue(true)).toBe(true)
    expect(normalizeStartAtLoginValue(false)).toBe(false)
    expect(normalizeStartAtLoginValue('true')).toBe(true)
    expect(normalizeStartAtLoginValue('false')).toBe(false)
  })
})
