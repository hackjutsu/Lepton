import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const builderConfig = require('../../electron-builder')

describe('electron-builder distribution config', () => {
  it('excludes duplicate runtime builds while retaining notebook language sources', () => {
    expect(builderConfig.files).toEqual(expect.arrayContaining([
      '!node_modules/prismjs/components/*.min.js',
      '!node_modules/**/node_modules/prismjs/components/*.min.js',
      '!node_modules/dompurify/dist/purify.cov.cjs.js',
      '!node_modules/bluebird/js/browser/**',
      '!node_modules/winston/dist/**'
    ]))
    expect(builderConfig.files).not.toContain('!node_modules/prismjs/**')
    expect(builderConfig.files).not.toContain('!node_modules/prismjs/components/**')
    expect(builderConfig.files).not.toContain('!node_modules/dompurify/dist/**')
  })

  it('names release artifacts with platform and architecture', () => {
    expect(builderConfig.artifactName).toBe('${productName}-${version}-${os}-${arch}.${ext}')
  })

  it('packages main-process runtime files used at startup', () => {
    expect(builderConfig.files).toEqual(expect.arrayContaining([
      'app/utilities/accessTokenStorage.js',
      'app/utilities/updatePolicy.js',
      'app/utilities/zoom/**'
    ]))
  })

  it('packages GitHub API bridge runtime dependencies', () => {
    expect(builderConfig.files).toEqual(expect.arrayContaining([
      'app/utilities/config/**',
      'app/utilities/githubApi/**'
    ]))
  })

  it('packages provider-neutral and GitLab API bridge dependencies', () => {
    expect(builderConfig.files).toEqual(expect.arrayContaining([
      'app/utilities/gitlabApi/**',
      'app/utilities/providerAccessPolicy.js',
      'app/utilities/snippetApi/**',
      'app/utilities/snippetProvider.js'
    ]))
  })

  it('ad-hoc signs macOS DMG and ZIP artifacts for Intel and Apple Silicon', () => {
    expect(builderConfig.mac.identity).toBe('-')
    expect(builderConfig.mac.hardenedRuntime).toBe(false)
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
