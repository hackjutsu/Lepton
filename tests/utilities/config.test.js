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

  it('does not enable download-all from old gist.downloadAll config', () => {
    expect(shouldDownloadAllSnippets(createConf({
      'gist:downloadAll': true
    }))).toBe(false)
  })

  it('disables download-all when neither setting is enabled', () => {
    expect(shouldDownloadAllSnippets(createConf())).toBe(false)
  })
})
