import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const builderConfig = require('../../electron-builder')

describe('electron-builder distribution config', () => {
  it('names release artifacts with platform and architecture', () => {
    expect(builderConfig.artifactName).toBe('${productName}-${version}-${os}-${arch}.${ext}')
  })

  it('packages main-process runtime files used at startup', () => {
    expect(builderConfig.files).toContain('app/utilities/updatePolicy.js')
  })

  it('builds macOS DMG and ZIP artifacts for Intel and Apple Silicon', () => {
    expect(builderConfig.mac.identity).toBeNull()
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

  it('keeps Linux targets schema-compatible and publishes snap to Snap Store', () => {
    expect(builderConfig.linux.target).toEqual([
      'AppImage',
      'snap'
    ])

    expect(builderConfig.linux.publish).toHaveLength(1)
    expect(builderConfig.linux.publish[0]).toMatchObject({
      provider: 'github'
    })

    expect(builderConfig.snap.publish).toHaveLength(1)
    expect(builderConfig.snap.publish[0]).toMatchObject({
      provider: 'snapStore',
      publishAutoUpdate: false
    })
  })
})
