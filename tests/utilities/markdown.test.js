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
})
