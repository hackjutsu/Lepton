import { describe, expect, it } from 'vitest'

import { isValidSnippetFilePath } from '../../app/utilities/snippetFilePath'

describe('snippet file path validation', () => {
  it('keeps GitHub filename validation unchanged', () => {
    expect(isValidSnippetFilePath('app.js', 'github')).toBe(true)
    expect(isValidSnippetFilePath('src/app.js', 'github')).toBe(false)
  })

  it('accepts nested GitLab file paths', () => {
    expect(isValidSnippetFilePath('src/app.js', 'gitlab')).toBe(true)
    expect(isValidSnippetFilePath('docs/guides/getting-started.md', 'gitlab')).toBe(true)
  })

  it.each([
    '',
    '/src/app.js',
    'src/app.js/',
    'src//app.js',
    'src/../app.js',
    'src/./app.js',
    'src\\app.js'
  ])('rejects unsafe or malformed GitLab paths: %s', value => {
    expect(isValidSnippetFilePath(value, 'gitlab')).toBe(false)
  })
})
