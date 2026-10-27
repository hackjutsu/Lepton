import { describe, expect, it } from 'vitest'

import Markdown from '../../app/utilities/markdown'

const { createMarkdownImageReference } = require('../../app/utilities/imageAttachments')

describe('markdown utility', () => {
  const pngBase64 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]).toString('base64')

  it.each(['diagram(.png', 'diagram).png', 'diagram [draft].png', 'diagram #1.png'])(
    'renders an inserted image reference with punctuation in its filename: %s', filename => {
      const html = Markdown.render(createMarkdownImageReference(filename), {
        siblingFiles: { [filename]: { filename, content: pngBase64 } }
      })

      expect(html).toContain(`src="data:image/png;base64,${pngBase64}"`)
      expect(html).toContain('lepton-markdown-sibling-image')
    }
  )

  it('renders GitHub-style emoji shortcodes as unicode emoji', () => {
    const html = Markdown.render('Ship it :tada: :rocket:')

    expect(html).toContain('\u{1F389}')
    expect(html).toContain('\u{1F680}')
    expect(html).not.toContain(':tada:')
    expect(html).not.toContain(':rocket:')
  })

  it('does not replace emoji shortcodes inside inline code', () => {
    const html = Markdown.render('Use `:tada:` in docs')

    expect(html).toContain('<code>:tada:</code>')
  })

  it('renders task list checkboxes as clickable inputs', () => {
    const html = Markdown.render('- [ ] open\n- [x] done')

    expect(html).toContain('class="task-list-item enabled"')
    expect(html).toContain('class="task-list-item-checkbox"type="checkbox"')
    expect(html).toContain('class="task-list-item-checkbox" checked=""type="checkbox"')
    expect(html).not.toContain('disabled')
  })

  it('does not trust user-authored checkbox html as a task list checkbox', () => {
    const html = Markdown.render('Raw <input class="task-list-item-checkbox"type="checkbox">')

    expect(html).toContain('&lt;input class=&quot;task-list-item-checkbox&quot;type=&quot;checkbox&quot;&gt;')
    expect(html).not.toContain('Raw <input class="task-list-item-checkbox"type="checkbox">')
  })

  it('renders inline and display math with KaTeX', () => {
    const html = Markdown.render('Inline $x^2$.\n\n$$\\frac{a}{b}$$')

    expect(html).toContain('class="katex"')
    expect(html).toContain('annotation encoding="application/x-tex">x^2')
    expect(html).toContain("class='katex-block'")
    expect(html).toContain('<mfrac>')
  })

  it('does not render raw html from malformed math content', () => {
    const html = Markdown.render('$<img src=x onerror=alert(1)>$')

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('renders Base64 image files referenced by sibling Markdown', () => {
    const siblingFiles = {
      'my image.png': {
        filename: 'my image.png',
        content: pngBase64
      }
    }
    const html = Markdown.render(
      '![Fixture](./my%20image.png "Sibling image")',
      { siblingFiles }
    )

    expect(html).toContain(`src="data:image/png;base64,${pngBase64}"`)
    expect(html).toContain('class="lepton-markdown-image lepton-markdown-sibling-image"')
    expect(html).toContain('data-lepton-image-filename="my image.png"')
    expect(html).toContain('data-lepton-image-reference="my image.png"')
    expect(html).toContain('alt="Fixture"')
    expect(html).toContain('title="Sibling image"')
  })

  it('leaves external HTTPS images unchanged', () => {
    const html = Markdown.render('![External](https://example.com/image.png)', {
      siblingFiles: {}
    })

    expect(html).toContain('src="https://example.com/image.png"')
    expect(html).toContain('class="lepton-markdown-image"')
    expect(html).not.toContain('lepton-markdown-sibling-image')
    expect(html).not.toContain('data-lepton-image-filename')
  })

  it.each([
    '../image.png',
    '%2Fimage.png',
    'file:image.png',
    '//example.com/image.png',
    'missing.png'
  ])('does not load an unresolved or unsafe relative image: %s', source => {
    const html = Markdown.render(`![Missing](${source})`, {
      siblingFiles: {
        'image.png': { filename: 'image.png', content: pngBase64 }
      }
    })

    expect(html).not.toContain(`src="${source}"`)
    expect(html).not.toContain('data:image/png')
  })

  it('marks an invalid sibling as actionable without exposing it as an image source', () => {
    const html = Markdown.render('![Broken](broken.png)', {
      siblingFiles: {
        'broken.png': { filename: 'broken.png', content: 'not-base64' }
      }
    })

    expect(html).toContain('class="lepton-markdown-image lepton-markdown-missing-image"')
    expect(html).toContain('data-lepton-image-filename="broken.png"')
    expect(html).toContain('data-lepton-image-reference="broken.png"')
    expect(html).not.toContain('src=')
  })

  it('keeps a missing sibling non-actionable while retaining its safe reference', () => {
    const html = Markdown.render('![Missing](missing.png)', { siblingFiles: {} })

    expect(html).toContain('data-lepton-image-reference="missing.png"')
    expect(html).not.toContain('data-lepton-image-filename')
    expect(html).not.toContain('src=')
  })

  it('escapes generated sibling filename attributes', () => {
    const html = Markdown.render('![Quoted](quote%22name.png)', {
      siblingFiles: {
        'quote"name.png': {
          filename: 'quote"name.png',
          content: pngBase64
        }
      }
    })

    expect(html).toContain('data-lepton-image-filename="quote&quot;name.png"')
    expect(html).not.toContain('data-lepton-image-filename="quote"name.png"')
  })

  it('does not grant raw HTML images access to sibling Base64 data', () => {
    const html = Markdown.render('<img src="image.png">', {
      siblingFiles: {
        'image.png': { filename: 'image.png', content: pngBase64 }
      }
    })

    expect(html).toContain('&lt;img src=&quot;image.png&quot;&gt;')
    expect(html).not.toContain('data:image/png')
  })
})
