import { describe, expect, it } from 'vitest'

import { buildGistFilesPatch } from '../../app/utilities/gistFilesPatch'

describe('gist file patch builder', () => {
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
