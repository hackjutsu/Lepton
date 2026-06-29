import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const SearchIndex = require('../../app/utilities/search')

describe('search utility', () => {
  beforeEach(() => {
    SearchIndex.resetFuseIndex([])
    SearchIndex.initFuseSearch()
  })

  it('ignores empty and one-character queries', () => {
    expect(SearchIndex.fuseSearch('')).toEqual([])
    expect(SearchIndex.fuseSearch('a')).toEqual([])
  })

  it('searches indexed gist fields', () => {
    SearchIndex.resetFuseIndex([
      {
        id: 'gist-1',
        description: 'React hooks note',
        filename: 'hooks.js',
        language: 'JavaScript'
      },
      {
        id: 'gist-2',
        description: 'SQL window function',
        filename: 'rank.sql',
        language: 'SQL'
      }
    ])
    SearchIndex.initFuseSearch()

    expect(SearchIndex.fuseSearch('hooks')).toEqual([
      expect.objectContaining({ id: 'gist-1' })
    ])
  })

  it('adds and updates indexed items', () => {
    SearchIndex.addToFuseIndex({
      id: 'gist-1',
      description: 'old description',
      filename: 'old.js',
      language: 'JavaScript'
    })
    SearchIndex.updateFuseIndex({
      id: 'gist-1',
      description: 'updated markdown guide',
      filename: 'guide.md',
      language: 'Markdown'
    })
    SearchIndex.initFuseSearch()

    expect(SearchIndex.fuseSearch('updated')).toEqual([
      expect.objectContaining({ id: 'gist-1', filename: 'guide.md' })
    ])
    expect(SearchIndex.fuseSearch('old')).toEqual([])
  })
})
