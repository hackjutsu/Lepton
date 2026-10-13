import { describe, expect, it } from 'vitest'

import {
  ALL_GIST_LANGUAGE,
  areGistFiltersEqual,
  createDefaultGistFilters,
  getActiveGistIdForFilters,
  getFilteredGistIds,
  normalizeGistFilters,
  pruneGistFilters
} from '../../app/utilities/gistFilters'
import { addLangPrefix as Prefixed } from '../../app/utilities/parser'

const gistTags = {
  [Prefixed('All')]: ['gist-3', 'gist-1', 'gist-2', 'gist-1'],
  [Prefixed('JavaScript')]: ['gist-2', 'gist-1'],
  [Prefixed('Markdown')]: ['gist-1', 'gist-3'],
  ui: ['gist-1', 'gist-3'],
  smoke: ['gist-1', 'gist-2']
}

describe('gist filters', () => {
  it('creates and normalizes serializable filter state', () => {
    expect(createDefaultGistFilters()).toEqual({
      language: ALL_GIST_LANGUAGE,
      tags: []
    })
    expect(normalizeGistFilters({
      language: Prefixed('JavaScript'),
      tags: ['ui', 'ui', Prefixed('Markdown'), null]
    })).toEqual({
      language: Prefixed('JavaScript'),
      tags: ['ui']
    })
  })

  it('preserves All ordering and removes duplicate gist ids', () => {
    expect(getFilteredGistIds(gistTags, createDefaultGistFilters()))
      .toEqual(['gist-3', 'gist-1', 'gist-2'])
  })

  it('intersects one language with every selected custom tag', () => {
    expect(getFilteredGistIds(gistTags, {
      language: Prefixed('JavaScript'),
      tags: ['ui', 'smoke']
    })).toEqual(['gist-1'])
  })

  it('keeps All ordering when a language bucket has a different order', () => {
    expect(getFilteredGistIds(gistTags, {
      language: Prefixed('JavaScript'),
      tags: []
    })).toEqual(['gist-1', 'gist-2'])
  })

  it('returns no matches for an unavailable selected filter', () => {
    expect(getFilteredGistIds(gistTags, {
      language: Prefixed('JavaScript'),
      tags: ['missing']
    })).toEqual([])
  })

  it('preserves a visible active gist and otherwise selects the first match', () => {
    const filters = {
      language: Prefixed('JavaScript'),
      tags: ['smoke']
    }

    expect(getActiveGistIdForFilters(gistTags, filters, 'gist-2')).toBe('gist-2')
    expect(getActiveGistIdForFilters(gistTags, filters, 'gist-3')).toBe('gist-1')
    expect(getActiveGistIdForFilters(gistTags, {
      language: Prefixed('JavaScript'),
      tags: ['missing']
    }, 'gist-1')).toBeNull()
  })

  it('prunes filters that disappeared after synchronization', () => {
    expect(pruneGistFilters({
      language: Prefixed('Python'),
      tags: ['ui', 'missing']
    }, gistTags)).toEqual({
      language: ALL_GIST_LANGUAGE,
      tags: ['ui']
    })
  })

  it('compares normalized filter values', () => {
    expect(areGistFiltersEqual(null, createDefaultGistFilters())).toBe(true)
    expect(areGistFiltersEqual(
      { language: Prefixed('JavaScript'), tags: ['ui'] },
      { language: Prefixed('JavaScript'), tags: ['smoke'] }
    )).toBe(false)
  })
})
