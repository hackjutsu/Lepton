import { describe, expect, it } from 'vitest'

import { addLangPrefix as Prefixed } from '../../app/utilities/parser'
import {
  getNextActiveGistFilters,
  isGistFilterActive
} from '../../app/containers/navigationPanel/tags'

describe('navigation panel tag helpers', () => {
  it('selects one language without clearing custom tags', () => {
    expect(getNextActiveGistFilters(Prefixed('JavaScript'), {
      language: Prefixed('All'),
      tags: ['ui']
    })).toEqual({
      language: Prefixed('JavaScript'),
      tags: ['ui']
    })
  })

  it('deselects the active language by falling back to All', () => {
    expect(getNextActiveGistFilters(Prefixed('JavaScript'), {
      language: Prefixed('JavaScript'),
      tags: ['ui']
    })).toEqual({
      language: Prefixed('All'),
      tags: ['ui']
    })
  })

  it('keeps All selected when All is clicked again', () => {
    expect(getNextActiveGistFilters(Prefixed('All'), {
      language: Prefixed('All'),
      tags: ['ui']
    })).toEqual({
      language: Prefixed('All'),
      tags: ['ui']
    })
  })

  it('toggles several custom tags independently', () => {
    const withSecondTag = getNextActiveGistFilters('smoke', {
      language: Prefixed('JavaScript'),
      tags: ['ui']
    })

    expect(withSecondTag).toEqual({
      language: Prefixed('JavaScript'),
      tags: ['ui', 'smoke']
    })
    expect(getNextActiveGistFilters('ui', withSecondTag)).toEqual({
      language: Prefixed('JavaScript'),
      tags: ['smoke']
    })
  })

  it('reports active language and custom filters', () => {
    const filters = {
      language: Prefixed('JavaScript'),
      tags: ['ui', 'smoke']
    }

    expect(isGistFilterActive(Prefixed('JavaScript'), filters)).toBe(true)
    expect(isGistFilterActive(Prefixed('Python'), filters)).toBe(false)
    expect(isGistFilterActive('ui', filters)).toBe(true)
    expect(isGistFilterActive('backend', filters)).toBe(false)
  })
})
