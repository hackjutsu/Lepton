import { describe, expect, it } from 'vitest'

import {
  addCustomTagsPrefix,
  addLangPrefix,
  descriptionParser,
  parseCustomTags,
  parseLangName
} from '../../app/utilities/parser'

describe('parser utilities', () => {
  it('falls back to the default description when the payload is empty', () => {
    expect(descriptionParser()).toEqual({
      title: '',
      description: 'No description',
      customTags: ''
    })
  })

  it('parses legacy title, description, and custom tag suffix', () => {
    expect(descriptionParser('[Title] body text #tags: js, react')).toEqual({
      title: 'Title',
      description: ' body text ',
      customTags: '#tags: js, react'
    })
  })

  it('keeps twitter-style hashtags in the description and exposes custom tags', () => {
    expect(descriptionParser('[Title] body text #js #react')).toEqual({
      title: 'Title',
      description: ' body text #js #react',
      customTags: '#tags:js, react'
    })
  })

  it('adds and removes language prefixes', () => {
    expect(addLangPrefix(' JavaScript ')).toBe('lang@JavaScript')
    expect(addLangPrefix('   ')).toBe('   ')
    expect(parseLangName('lang@Python')).toBe('Python')
    expect(parseLangName('Ruby')).toBe('Ruby')
    expect(parseLangName()).toBe('Other')
  })

  it('adds and parses custom tag prefixes', () => {
    expect(addCustomTagsPrefix(' alpha, beta ')).toBe('#tags:alpha, beta')
    expect(addCustomTagsPrefix('   ')).toBe('   ')
    expect(parseCustomTags('#tags: alpha, beta，gamma、delta')).toEqual([
      'alpha',
      'beta',
      'gamma',
      'delta'
    ])
    expect(parseCustomTags('alpha, beta')).toEqual([])
  })
})
