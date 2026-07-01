import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const builderConfig = require('../../electron-builder')

describe('electron-builder distribution config', () => {
  it('names release artifacts with platform and architecture', () => {
    expect(builderConfig.artifactName).toBe('${productName}-${version}-${os}-${arch}.${ext}')
  })

  it('builds macOS DMG and ZIP artifacts for Intel and Apple Silicon', () => {
    expect(builderConfig.mac.target).toEqual([
      {
        target: 'dmg',
        arch: [
          'x64',
          'arm64'
        ]
      },
      {
        target: 'zip',
        arch: [
          'x64',
          'arm64'
        ]
      }
    ])
  })

  it('publishes AppImage only to GitHub and snap to GitHub plus Snap Store', () => {
    const appImageTarget = builderConfig.linux.target.find(target => target.target === 'AppImage')
    const snapTarget = builderConfig.linux.target.find(target => target.target === 'snap')

    expect(appImageTarget.publish).toHaveLength(1)
    expect(appImageTarget.publish[0]).toMatchObject({
      provider: 'github'
    })

    expect(snapTarget.publish).toHaveLength(2)
    expect(snapTarget.publish[0]).toMatchObject({
      provider: 'github'
    })
    expect(snapTarget.publish[1]).toMatchObject({
      provider: 'snapStore',
      publishAutoUpdate: false
    })
  })
})
