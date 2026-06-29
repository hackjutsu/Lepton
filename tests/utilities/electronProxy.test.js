import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const {
  applyElectronProxy,
  createElectronProxyConfig,
  normalizeElectronProxyRules
} = require('../../app/utilities/electronProxy')

function createConf (values = {}) {
  return {
    get: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : false
  }
}

function createLogger () {
  return {
    info: vi.fn(),
    warn: vi.fn()
  }
}

describe('Electron proxy utility', () => {
  it('skips Electron proxy config when disabled', () => {
    expect(createElectronProxyConfig(createConf({
      'proxy:enable': false,
      'proxy:address': 'socks://localhost:1080'
    }))).toBeNull()
  })

  it('builds fixed-server proxy config from .leptonrc proxy settings', () => {
    expect(createElectronProxyConfig(createConf({
      'proxy:enable': true,
      'proxy:address': 'http://proxy.example.test:8080'
    }))).toEqual({
      mode: 'fixed_servers',
      proxyRules: 'http://proxy.example.test:8080',
      proxyBypassRules: '<local>'
    })
  })

  it('normalizes Lepton socks shorthand for Chromium proxy rules', () => {
    expect(normalizeElectronProxyRules('socks://localhost:1080'))
      .toBe('socks5://localhost:1080')
  })

  it('preserves advanced Chromium proxy rule lists', () => {
    expect(normalizeElectronProxyRules('http=proxy1:80;socks=socks-proxy:1080'))
      .toBe('http=proxy1:80;socks=socks-proxy:1080')
  })

  it('maps proxy-agent PAC addresses to Electron PAC script mode', () => {
    expect(createElectronProxyConfig(createConf({
      'proxy:enable': true,
      'proxy:address': 'pac+https://proxy.example.test/proxy.pac'
    }))).toEqual({
      mode: 'pac_script',
      pacScript: 'https://proxy.example.test/proxy.pac'
    })
  })

  it('applies Electron proxy config to the default session', async () => {
    const setProxy = vi.fn(() => Promise.resolve())
    const logger = createLogger()

    await expect(applyElectronProxy({
      session: { defaultSession: { setProxy } },
      conf: createConf({
        'proxy:enable': true,
        'proxy:address': 'socks://localhost:1080'
      }),
      logger
    })).resolves.toBe(true)

    expect(setProxy).toHaveBeenCalledWith({
      mode: 'fixed_servers',
      proxyRules: 'socks5://localhost:1080',
      proxyBypassRules: '<local>'
    })
    expect(logger.info).toHaveBeenCalledWith('[proxy] Electron session proxy enabled')
  })

  it('does not block startup when Electron proxy config fails', async () => {
    const logger = createLogger()

    await expect(applyElectronProxy({
      session: {
        defaultSession: {
          setProxy: vi.fn(() => Promise.reject(new Error('bad proxy')))
        }
      },
      conf: createConf({
        'proxy:enable': true,
        'proxy:address': 'http://proxy.example.test:8080'
      }),
      logger
    })).resolves.toBe(false)

    expect(logger.warn).toHaveBeenCalledWith('[proxy] Failed to apply Electron session proxy: bad proxy')
  })
})
