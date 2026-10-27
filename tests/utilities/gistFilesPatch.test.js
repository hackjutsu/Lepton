import { describe, expect, it } from 'vitest'

import { buildGistFilesPatch } from '../../app/utilities/gistFilesPatch'

describe('gist file patch builder', () => {
  it('preserves prototype-named GitLab files when updating and deleting', () => {
    const existingFiles = JSON.parse('{"__proto__":{},"constructor":{}}')
    const patch = buildGistFilesPatch([
      { filename: '__proto__', content: 'updated content' }
    ], existingFiles)

    expect(Object.keys(patch).sort()).toEqual(['__proto__', 'constructor'])
    expect(patch.__proto__).toEqual({ content: 'updated content' })
    expect(patch.constructor).toBe(null)
    expect(Object.getPrototypeOf(patch)).toBe(null)
  })

  it('omits retained GitHub binary files while updating text and Base64-text files', () => {
    expect(buildGistFilesPatch([
      { filename: 'notes.md', content: '# Updated' },
      { filename: 'diagram.png', content: 'encoded-image-text' },
      {
        filename: 'native.png',
        content: 'github-transport-base64',
        _nativeBinary: true,
        _originalFilename: 'native.png'
      }
    ], {
      'notes.md': {},
      'diagram.png': {},
      'native.png': {}
    })).toEqual({
      'notes.md': { content: '# Updated' },
      'diagram.png': { content: 'encoded-image-text' }
    })
  })

  it('deletes a native binary only when it is explicitly removed from the form', () => {
    expect(buildGistFilesPatch([
      { filename: 'notes.md', content: '# Updated' }
    ], {
      'notes.md': {},
      'native.png': {}
    })).toEqual({
      'notes.md': { content: '# Updated' },
      'native.png': null
    })
  })
})
