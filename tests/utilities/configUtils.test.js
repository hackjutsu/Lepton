import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { downloadAllSnippets } = require('../../app/utilities/config')

function createConf (values = {}) {
  return {
    get: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : false
  }
}

describe('config utilities', () => {
  it('reads snippet downloadAll from the current config path', () => {
    expect(downloadAllSnippets(createConf({
      'snippet:downloadAll': true
    }))).toBe(true)
  })

  it('leaves downloadAll disabled by default', () => {
    expect(downloadAllSnippets(createConf())).toBe(false)
  })
})
