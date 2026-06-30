import { describe, expect, it } from 'vitest'

import Markdown from '../../app/utilities/markdown'

describe('markdown utility', () => {
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
})
