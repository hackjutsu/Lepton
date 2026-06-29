import { describe, expect, it } from 'vitest'

import {
  compareGists,
  getSortableValue
} from '../../app/containers/navigationPanelDetails/sorting'

function gist (id, brief) {
  return {
    brief: {
      id,
      ...brief
    }
  }
}

describe('navigation panel detail sorting', () => {
  it('normalizes missing sort values before comparing', () => {
    expect(getSortableValue(gist('missing', {}), 'description')).toBe('')
    expect(getSortableValue(gist('null', { description: null }), 'description')).toBe('')
    expect(getSortableValue(undefined, 'description')).toBe('')
    expect(getSortableValue(gist('numeric', { files: 2 }), 'files')).toBe('2')
  })

  it('sorts snippets by description when some descriptions are empty', () => {
    const sorted = [
      gist('beta', { description: 'Beta' }),
      gist('null', { description: null }),
      gist('alpha', { description: 'Alpha' }),
      gist('missing', {})
    ].sort(compareGists('description', false))

    expect(sorted.map(item => item.brief.id)).toEqual([
      'null',
      'missing',
      'alpha',
      'beta'
    ])
  })

  it('keeps reverse snippet sorting null-safe', () => {
    const sorted = [
      gist('one', { description: 'One' }),
      gist('empty', { description: null }),
      gist('two', { description: 'Two' })
    ].sort(compareGists('description', true))

    expect(sorted.map(item => item.brief.id)).toEqual([
      'two',
      'one',
      'empty'
    ])
  })
})
