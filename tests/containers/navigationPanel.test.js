import { describe, expect, it } from 'vitest'

import { addLangPrefix as Prefixed } from '../../app/utilities/parser'
import { getNextActiveGistTag } from '../../app/containers/navigationPanel/tags'

describe('navigation panel tag helpers', () => {
  it('selects the clicked tag when it is not active', () => {
    expect(getNextActiveGistTag('tmux', Prefixed('All'))).toBe('tmux')
  })

  it('deselects the active tag by falling back to All', () => {
    expect(getNextActiveGistTag('tmux', 'tmux')).toBe(Prefixed('All'))
  })

  it('keeps All selected when All is clicked again', () => {
    expect(getNextActiveGistTag(Prefixed('All'), Prefixed('All'))).toBe(Prefixed('All'))
  })
})
