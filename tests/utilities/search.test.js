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
    expect(SearchIndex.fuseSearch('HOOKS')).toEqual([
      expect.objectContaining({ id: 'gist-1' })
    ])
    expect(SearchIndex.fuseSearch('hoks')).toEqual([])
    expect(SearchIndex.fuseSearch('react note')).toEqual([
      expect.objectContaining({
        id: 'gist-1',
        searchMeta: expect.objectContaining({
          matches: expect.arrayContaining([
            expect.objectContaining({
              key: 'description',
              segments: expect.arrayContaining([
                expect.objectContaining({ match: true, text: 'React' }),
                expect.objectContaining({ match: true, text: 'note' })
              ])
            })
          ])
        })
      })
    ])
  })

  it('searches loaded gist file content', () => {
    SearchIndex.resetFuseIndex([
      SearchIndex.buildSearchRecord({
        id: 'gist-1',
        description: 'Utility helper',
        files: {
          'helper.js': {
            language: 'JavaScript',
            content: 'export const hiddenNeedle = true\n'
          }
        }
      })
    ])
    SearchIndex.initFuseSearch()

    expect(SearchIndex.fuseSearch('hiddenneedle true')).toEqual([
      expect.objectContaining({
        id: 'gist-1',
        searchMeta: expect.objectContaining({
          matches: expect.arrayContaining([
            expect.objectContaining({
              key: 'files.content',
              segments: expect.arrayContaining([
                expect.objectContaining({ match: true, text: 'hiddenNeedle' }),
                expect.objectContaining({ match: true, text: 'true' })
              ])
            })
          ]),
          bestMatch: expect.objectContaining({
            key: 'files.content',
            filename: 'helper.js',
            excerpt: expect.objectContaining({
              segments: expect.arrayContaining([
                expect.objectContaining({ match: true, text: 'hiddenNeedle' }),
                expect.objectContaining({ match: true, text: 'true' })
              ])
            })
          })
        })
      })
    ])
  })

  it('adds and updates indexed items', () => {
    SearchIndex.addToFuseIndex(SearchIndex.buildSearchRecord({
      id: 'gist-1',
      description: 'old description',
      files: {
        'old.js': {
          language: 'JavaScript',
          content: 'const staleNeedle = true'
        }
      }
    }))
    SearchIndex.updateFuseIndex(SearchIndex.buildSearchRecord({
      id: 'gist-1',
      description: 'updated markdown guide',
      files: {
        'guide.md': {
          language: 'Markdown',
          content: 'const freshNeedle = true'
        }
      }
    }))
    SearchIndex.initFuseSearch()

    expect(SearchIndex.fuseSearch('updated')).toEqual([
      expect.objectContaining({ id: 'gist-1', filename: 'guide.md' })
    ])
    expect(SearchIndex.fuseSearch('old')).toEqual([])
    expect(SearchIndex.fuseSearch('staleNeedle')).toEqual([])
    expect(SearchIndex.fuseSearch('freshNeedle')).toEqual([
      expect.objectContaining({ id: 'gist-1' })
    ])
  })

  it('builds a brief-only search record without content files', () => {
    expect(SearchIndex.buildSearchRecord({
      id: 'gist-1',
      description: 'Brief result',
      updated_at: '2024-01-02T03:04:05Z',
      files: {
        'brief.js': {
          language: 'JavaScript'
        },
        'notes.md': {
          language: 'Markdown',
          content: null
        }
      }
    })).toEqual({
      id: 'gist-1',
      description: 'Brief result',
      updated_at: '2024-01-02T03:04:05Z',
      language: 'JavaScript,Markdown',
      filename: 'brief.js, notes.md',
      files: []
    })
  })

  it('builds a content search record from loaded details', () => {
    const record = SearchIndex.buildSearchRecord({
      brief: {
        id: 'gist-1',
        description: 'Brief description',
        updated_at: '2024-01-01T00:00:00Z',
        files: {
          'app.js': { language: 'JavaScript' }
        }
      },
      details: {
        id: 'gist-1',
        description: 'Detailed description',
        updated_at: '2024-02-01T00:00:00Z',
        files: {
          'app.js': {
            language: 'JavaScript',
            content: 'const loaded = true'
          }
        }
      }
    })

    expect(record).toEqual({
      id: 'gist-1',
      description: 'Detailed description',
      updated_at: '2024-02-01T00:00:00Z',
      language: 'JavaScript',
      filename: 'app.js',
      files: [
        {
          filename: 'app.js',
          language: 'JavaScript',
          content: 'const loaded = true'
        }
      ]
    })
  })

  it('builds search records from created and edited gist shapes', () => {
    const createdDetails = {
      id: 'gist-created',
      description: 'Created gist',
      files: {
        'created.js': {
          language: 'JavaScript',
          content: 'const created = true'
        }
      }
    }
    const editedDetails = {
      id: 'gist-edited',
      description: 'Edited gist',
      files: {
        'edited.py': {
          language: 'Python',
          content: 'edited_value = True'
        }
      }
    }

    expect(SearchIndex.buildSearchRecord(createdDetails)).toEqual(expect.objectContaining({
      id: 'gist-created',
      filename: 'created.js',
      language: 'JavaScript',
      files: [
        expect.objectContaining({ content: 'const created = true' })
      ]
    }))

    expect(SearchIndex.buildSearchRecord({
      langs: new Set(['Python']),
      brief: editedDetails,
      details: editedDetails,
      filename: ', edited.py'
    })).toEqual(expect.objectContaining({
      id: 'gist-edited',
      filename: 'edited.py',
      language: 'Python',
      files: [
        expect.objectContaining({ content: 'edited_value = True' })
      ]
    }))
  })

  it('creates safe highlighted excerpt segments', () => {
    const excerpt = SearchIndex.createHighlightedExcerpt(
      'alpha beta gamma delta',
      [[6, 9]],
      20
    )

    expect(excerpt.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ match: false, text: expect.stringContaining('alpha') }),
      expect.objectContaining({ match: true, text: 'beta' })
    ]))
  })

  it('keeps content excerpts focused near the matched phrase', () => {
    const excerpt = SearchIndex.createHighlightedExcerpt(
      `${'prefix '.repeat(40)}target ${'suffix '.repeat(40)}`,
      [[280, 285]]
    )
    const matchIndex = excerpt.segments.findIndex(segment => segment.match)
    const textBeforeMatch = excerpt.segments
      .slice(0, matchIndex)
      .map(segment => segment.text)
      .join('')

    expect(excerpt.segments[0]).toEqual({ text: '...', match: false })
    expect(excerpt.segments).toContainEqual({ text: 'target', match: true })
    expect(textBeforeMatch.length).toBeLessThanOrEqual(40)
  })
})
