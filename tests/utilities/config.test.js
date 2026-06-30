import { describe, expect, it } from 'vitest'
import { shouldDownloadAllSnippets } from '../../app/utilities/config'

function createConf (values = {}) {
  return {
    get: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined
  }
}

describe('configuration utilities', () => {
  it('uses snippet.downloadAll as the canonical download-all setting', () => {
    expect(shouldDownloadAllSnippets(createConf({
      'snippet:downloadAll': true
    }))).toBe(true)
  })

  it('keeps gist.downloadAll as a backward-compatible fallback', () => {
    expect(shouldDownloadAllSnippets(createConf({
      'gist:downloadAll': true
    }))).toBe(true)
  })

  it('disables download-all when neither setting is enabled', () => {
    expect(shouldDownloadAllSnippets(createConf())).toBe(false)
  })
})
