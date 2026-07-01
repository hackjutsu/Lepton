import { describe, expect, it } from 'vitest'

import {
  compareVersions,
  getUpdateCheckDecision,
  getUpdateNotificationDecision,
  isStableVersion,
  parseVersion
} from '../../app/utilities/updatePolicy'

describe('update policy', () => {
  it('parses stable and prerelease semver strings', () => {
    expect(parseVersion('v1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ''
    })
    expect(parseVersion('1.2.3-beta.1')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: 'beta.1'
    })
    expect(parseVersion('latest')).toBeNull()
  })

  it('identifies only non-prerelease versions as stable', () => {
    expect(isStableVersion('1.2.3')).toBe(true)
    expect(isStableVersion('1.2.3+build.4')).toBe(true)
    expect(isStableVersion('1.2.3-alpha.1')).toBe(false)
    expect(isStableVersion(undefined)).toBe(false)
  })

  it('compares version precedence by major, minor, and patch', () => {
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1)
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0)
    expect(compareVersions('2.0.0', '2.0.1')).toBe(-1)
    expect(compareVersions('not-a-version', '2.0.1')).toBeNull()
  })

  it('only checks for updates from stable production builds with autoUpdate enabled', () => {
    expect(getUpdateCheckDecision({
      autoUpdate: true,
      currentVersion: '1.2.3',
      isDev: false
    }).shouldCheck).toBe(true)

    expect(getUpdateCheckDecision({
      autoUpdate: true,
      currentVersion: '1.2.3-beta.1',
      isDev: false
    })).toEqual({
      reason: 'current version is not a stable release',
      shouldCheck: false
    })

    expect(getUpdateCheckDecision({
      autoUpdate: false,
      currentVersion: '1.2.3',
      isDev: false
    }).shouldCheck).toBe(false)

    expect(getUpdateCheckDecision({
      autoUpdate: true,
      currentVersion: '1.2.3',
      isDev: true
    }).shouldCheck).toBe(false)
  })

  it('notifies only for newer stable update candidates', () => {
    expect(getUpdateNotificationDecision({
      currentVersion: '1.2.3',
      updateInfo: { version: '1.2.4' }
    }).shouldNotify).toBe(true)

    expect(getUpdateNotificationDecision({
      currentVersion: '1.2.3',
      updateInfo: { version: '1.2.4-rc.1' }
    })).toEqual({
      reason: 'candidate version is not a stable release',
      shouldNotify: false
    })

    expect(getUpdateNotificationDecision({
      currentVersion: '1.2.3-beta.1',
      updateInfo: { version: '1.2.4' }
    }).shouldNotify).toBe(false)

    expect(getUpdateNotificationDecision({
      currentVersion: '1.2.3',
      updateInfo: { version: '1.2.3' }
    })).toEqual({
      reason: 'candidate version is not newer',
      shouldNotify: false
    })

    expect(getUpdateNotificationDecision({
      currentVersion: '1.2.3',
      updateInfo: { version: 'invalid' }
    }).shouldNotify).toBe(false)
  })
})
