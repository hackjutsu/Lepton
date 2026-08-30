import { beforeEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'

import {
  ACTIVE_HIGHLIGHT_NAME,
  createPageFinder,
  MATCH_HIGHLIGHT_NAME
} from '../../app/utilities/pageFind'

class TestHighlight extends Set {
  constructor (...ranges) {
    super(ranges)
    this.priority = 0
  }
}

describe('page finder', () => {
  let document
  let finder
  let highlights

  beforeEach(() => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <main>Fixture text and another FIXTURE.</main>
      <div class="find-in-page">fixture</div>
      <div hidden>fixture</div>
    </body></html>`)
    document = dom.window.document
    highlights = new Map()
    dom.window.CSS = { highlights }
    dom.window.Highlight = TestHighlight
    finder = createPageFinder(document)
  })

  it('highlights page text while excluding the find UI and hidden content', () => {
    expect(finder.search('fixture')).toEqual({
      activeMatchOrdinal: 1,
      matches: 2
    })
    expect(highlights.get(MATCH_HIGHLIGHT_NAME).size).toBe(1)
    expect(highlights.get(ACTIVE_HIGHLIGHT_NAME).size).toBe(1)
  })

  it('moves in both directions, wraps, and clears highlights', () => {
    finder.search('fixture')
    expect(finder.navigate(true).activeMatchOrdinal).toBe(2)
    expect(finder.navigate(true).activeMatchOrdinal).toBe(1)
    expect(finder.navigate(false).activeMatchOrdinal).toBe(2)

    finder.clear()
    expect(highlights.size).toBe(0)
  })
})
