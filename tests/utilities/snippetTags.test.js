import { describe, expect, it } from 'vitest'

import { cloneSnippetTagMap } from '../../app/utilities/snippetTags'

describe('snippet tag maps', () => {
  it('preserves prototype-named tags as ordinary own entries', () => {
    const source = Object.create(null)
    source.__proto__ = ['gist-1']

    const result = cloneSnippetTagMap(source)

    expect(Object.getPrototypeOf(result)).toBeNull()
    expect(Object.keys(result)).toEqual(['__proto__'])
    expect(result.__proto__).toEqual(['gist-1'])
    expect(result.__proto__).not.toBe(source.__proto__)
  })
})
