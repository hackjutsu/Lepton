import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { parseCommandLineConfig } = require('../../app/utilities/config/commandLineConfig')

describe('command-line config parsing', () => {
  it('parses colon-separated nconf paths', () => {
    expect(parseCommandLineConfig(['--logger:level=error'])).toEqual({
      logger: {
        level: 'error'
      }
    })
  })

  it('parses dot-separated option paths', () => {
    expect(parseCommandLineConfig(['--snippet.sorting=created_at'])).toEqual({
      snippet: {
        sorting: 'created_at'
      }
    })
  })

  it('parses long-option values and flags', () => {
    expect(parseCommandLineConfig([
      '--theme',
      'dark',
      '--proxy:enable',
      '--no-autoUpdate'
    ])).toEqual({
      theme: 'dark',
      proxy: {
        enable: true
      },
      autoUpdate: false
    })
  })

  it('coerces numeric values like yargs', () => {
    expect(parseCommandLineConfig([
      '--editor:tabSize=2',
      '--count=1e3',
      '--padded=001'
    ])).toEqual({
      editor: {
        tabSize: 2
      },
      count: 1000,
      padded: '001'
    })
  })

  it('does not consume the next option as a value', () => {
    expect(parseCommandLineConfig([
      '--theme',
      '--logger:level=debug'
    ])).toEqual({
      theme: true,
      logger: {
        level: 'debug'
      }
    })
  })

  it('collects repeated options into arrays', () => {
    expect(parseCommandLineConfig([
      '--tag=react',
      '--tag=electron'
    ])).toEqual({
      tag: ['react', 'electron']
    })
  })

  it('adds camelCase aliases for dashed option names', () => {
    expect(parseCommandLineConfig([
      '--auto-update=false',
      '--snippet.new-snippet-private'
    ])).toEqual({
      'auto-update': 'false',
      autoUpdate: 'false',
      snippet: {
        'new-snippet-private': true,
        newSnippetPrivate: true
      }
    })
  })

  it('stops parsing options after a double dash', () => {
    expect(parseCommandLineConfig([
      '--theme=dark',
      '--',
      '--logger:level=debug'
    ])).toEqual({
      theme: 'dark'
    })
  })
})
