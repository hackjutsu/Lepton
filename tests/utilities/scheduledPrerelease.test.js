import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildReleaseNotes,
  getLatestRelease,
  getNextBetaVersion,
  getPreviousReleaseTag,
  getSemverReleases,
  resolveScheduledPrerelease
} = require('../../.github/scripts/resolve-scheduled-prerelease')

function release (tagName, options = {}) {
  return {
    tagName,
    isDraft: false,
    isPrerelease: tagName.includes('-'),
    ...options
  }
}

describe('scheduled prerelease resolver', () => {
  it('starts the next patch beta after a stable latest release', () => {
    const latestRelease = getLatestRelease(getSemverReleases([
      release('v2.0.0'),
      release('v2.0.0-beta.15')
    ]))

    expect(getNextBetaVersion(latestRelease)).toBe('2.0.1-beta.1')
  })

  it('increments only the beta number after a beta latest release', () => {
    const result = resolveScheduledPrerelease({
      masterSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      releases: [
        release('v2.0.1-beta.3'),
        release('v2.0.0')
      ],
      resolveTagSha: tagName => ({
        'v2.0.1-beta.3': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'v2.0.0': '9999999999999999999999999999999999999999'
      })[tagName]
    })

    expect(result).toMatchObject({
      shouldRelease: true,
      nextVersion: '2.0.1-beta.4',
      nextTag: 'v2.0.1-beta.4',
      previousTag: 'v2.0.1-beta.3'
    })
  })

  it('skips when the master commit already has a release', () => {
    const result = resolveScheduledPrerelease({
      masterSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      releases: [
        release('v2.0.1-beta.3'),
        release('v2.0.0')
      ],
      resolveTagSha: tagName => ({
        'v2.0.1-beta.3': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'v2.0.0': '9999999999999999999999999999999999999999'
      })[tagName]
    })

    expect(result).toMatchObject({
      shouldRelease: false,
      releasedTag: 'v2.0.1-beta.3'
    })
  })

  it('ignores draft releases when deciding whether master is released', () => {
    const result = resolveScheduledPrerelease({
      masterSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      releases: [
        release('v2.0.1-beta.3', { isDraft: true }),
        release('v2.0.0')
      ],
      resolveTagSha: tagName => ({
        'v2.0.1-beta.3': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'v2.0.0': '9999999999999999999999999999999999999999'
      })[tagName]
    })

    expect(result).toMatchObject({
      shouldRelease: true,
      nextVersion: '2.0.1-beta.1'
    })
  })

  it('fails clearly for unsupported latest prerelease labels', () => {
    expect(() => resolveScheduledPrerelease({
      masterSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      releases: [
        release('v2.0.1-rc.1'),
        release('v2.0.0')
      ],
      resolveTagSha: tagName => ({
        'v2.0.1-rc.1': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'v2.0.0': '9999999999999999999999999999999999999999'
      })[tagName]
    })).toThrow('unsupported prerelease label "rc.1"')
  })

  it('finds the previous release tag by semver precedence', () => {
    expect(getPreviousReleaseTag([
      release('v2.0.1-beta.4'),
      release('v2.0.1-beta.3'),
      release('v2.0.0')
    ], 'v2.0.1-beta.4')).toBe('v2.0.1-beta.3')
  })

  it('includes version and commit traceability in release notes', () => {
    const notes = buildReleaseNotes({
      version: '2.0.1-beta.4',
      tag: 'v2.0.1-beta.4',
      sourceSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      previousTag: 'v2.0.1-beta.3',
      repository: 'hackjutsu/Lepton',
      runUrl: 'https://github.com/hackjutsu/Lepton/actions/runs/123'
    })

    expect(notes).toContain('Version: 2.0.1-beta.4')
    expect(notes).toContain('Source commit: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    expect(notes).toContain('https://github.com/hackjutsu/Lepton/compare/v2.0.1-beta.3...v2.0.1-beta.4')
    expect(notes).toContain('https://github.com/hackjutsu/Lepton/actions/runs/123')
  })
})
