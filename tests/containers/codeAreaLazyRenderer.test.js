import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const mocks = vi.hoisted(() => ({ notebookRender: vi.fn() }))

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    config: { get: () => 'light' },
    logger: { error: vi.fn() },
    notebook: { render: mocks.notebookRender }
  }
}))
vi.mock('../../app/utilities/themeManager', () => ({ getHighlightTheme: () => 'github' }))
vi.mock('highlightjs-solidity', () => ({ default: () => {} }))
vi.mock('highlightjs-graphql', () => ({ default: () => {} }))
vi.mock('../../app/utilities/markdown', () => ({ default: { render: text => text } }))
vi.mock('../../app/utilities/asciidoc', () => ({
  default: { render: text => `<p>${text}</p>` }
}))

// CodeArea selects a theme through CommonJS; Node needs a CSS stub for that
// import. Electron smoke tests verify the real stylesheet and rendering.
const require = createRequire(import.meta.url)
const cssLoader = require.extensions['.css']
require.extensions['.css'] = () => {}
let CodeArea
try {
  CodeArea = (await import('../../app/containers/codeArea')).default
} finally {
  if (cssLoader) require.extensions['.css'] = cssLoader
  else delete require.extensions['.css']
}

function createCodeArea (language) {
  const component = new CodeArea({ filename: 'example', language, content: 'original' })
  component.setState = vi.fn(update => { Object.assign(component.state, update) })
  return component
}

describe('on-demand AsciiDoc rendering', () => {
  it('does not load the converter for ordinary snippets, then loads on a format change', async () => {
    const component = createCodeArea('JavaScript')
    component.componentDidMount()
    expect(component.asciiDocLoad).toBeUndefined()
    component.props = { ...component.props, language: 'AsciiDoc' }
    component.componentDidUpdate()
    await component.asciiDocLoad
    expect(component.createAsciiDocCodeBlock('latest', 'AsciiDoc', 4)).toContain('<p>latest</p>')
    expect(component.setState).toHaveBeenCalledTimes(1)
    component.componentDidUpdate()
    expect(component.setState).toHaveBeenCalledTimes(1)
  })

  it('keeps readable source while loading and does not update an unmounted component', async () => {
    const component = createCodeArea('AsciiDoc')
    expect(component.createAsciiDocCodeBlock('plain source', 'AsciiDoc', 4)).toContain('plain source')
    component.componentDidMount()
    component.componentWillUnmount()
    await component.asciiDocLoad
    expect(component.setState).not.toHaveBeenCalled()
  })
})

describe('snippet render caching', () => {
  it('retries notebook rendering after an IPC failure instead of caching the fallback', () => {
    mocks.notebookRender.mockReturnValueOnce({ status: false, error: 'Unavailable' })
      .mockReturnValue({ status: true, html: '<p>Recovered notebook</p>' })
    const component = createCodeArea('Jupyter Notebook')
    const render = () => component.getRenderedContent('example.ipynb', '{}', 'Jupyter Notebook', 4)
    expect(render()).not.toContain('Recovered notebook')
    expect(render()).toContain('Recovered notebook')
    expect(render()).toContain('Recovered notebook')
    expect(mocks.notebookRender).toHaveBeenCalledTimes(2)
  })

  it('reuses unchanged code and invalidates when content or rendering inputs change', () => {
    const component = createCodeArea('JavaScript')
    const highlight = vi.spyOn(component, 'createHighlightedCodeBlock')
    const files = {}
    const first = component.getRenderedContent('example.js', 'const a = 1', 'JavaScript', 4, files)
    expect(component.getRenderedContent('example.js', 'const a = 1', 'JavaScript', 4, files)).toBe(first)
    expect(highlight).toHaveBeenCalledTimes(1)
    component.getRenderedContent('example.js', 'const a = 2', 'JavaScript', 4, files)
    component.getRenderedContent('example.js', 'const a = 2', 'JavaScript', 2, files)
    component.getRenderedContent('example.py', 'const a = 2', 'Python', 2, files)
    expect(highlight).toHaveBeenCalledTimes(4)
  })

  it('invalidates Markdown when sibling attachments change', () => {
    const component = createCodeArea('Markdown')
    const markdown = vi.spyOn(component, 'createMarkdownCodeBlock')
    const files = {}
    component.getRenderedContent('notes.md', '![image](image.png)', 'Markdown', 4, files)
    component.getRenderedContent('notes.md', '![image](image.png)', 'Markdown', 4, files)
    expect(markdown).toHaveBeenCalledTimes(1)
    component.getRenderedContent('notes.md', '![image](image.png)', 'Markdown', 4, { 'image.png': {} })
    expect(markdown).toHaveBeenCalledTimes(2)
  })

  it('replaces cached source after the AsciiDoc converter loads', async () => {
    const component = createCodeArea('AsciiDoc')
    const initial = component.getRenderedContent('example.adoc', 'Example', 'AsciiDoc', 4)
    expect(initial).not.toContain('asciidoc-section')
    component.componentDidMount()
    await component.asciiDocLoad
    expect(component.getRenderedContent('example.adoc', 'Example', 'AsciiDoc', 4)).toContain('<p>Example</p>')
  })

  it('avoids repeated notebook IPC while keeping only the latest result', () => {
    const component = createCodeArea('Jupyter Notebook')
    const notebook = vi.spyOn(component, 'createJupyterNotebookCodeBlock').mockImplementation(content => content)
    component.getRenderedContent('example.ipynb', 'first', 'Jupyter Notebook', 4)
    component.getRenderedContent('example.ipynb', 'first', 'Jupyter Notebook', 4)
    expect(notebook).toHaveBeenCalledTimes(1)
    component.getRenderedContent('example.ipynb', 'second', 'Jupyter Notebook', 4)
    component.getRenderedContent('example.ipynb', 'first', 'Jupyter Notebook', 4)
    expect(notebook).toHaveBeenCalledTimes(3)
  })
})
