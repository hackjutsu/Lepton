import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import notebookCore from '../../app/utilities/jupyterNotebook/core'

const { renderNotebookContent } = notebookCore

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(currentDir, '..', 'fixtures', 'jupyter', 'basic-notebook.ipynb')

describe('Jupyter notebook renderer', () => {
  it('renders markdown, code cells, and outputs from a notebook fixture', () => {
    const html = renderNotebookContent(readFileSync(fixturePath, 'utf8'))

    expect(html).toContain('class="nb-notebook"')
    expect(html).toContain('<h1>Notebook Fixture</h1>')
    expect(html).toContain('<strong>markdown</strong>')
    expect(html).toContain('class="nb-cell nb-code-cell"')
    expect(html).toContain('data-prompt-number="1"')
    expect(html).toContain('print')
    expect(html).toContain('hello from notebook')
    expect(html).toContain('42')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert')
  })
})
