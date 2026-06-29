import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import Panel, { Collapse } from '../../app/containers/compatPanel'

const h = React.createElement

describe('React 19 panel compatibility', () => {
  let container
  let root

  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost'
    })

    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.Node = dom.window.Node

    container = document.getElementById('root')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })

    delete globalThis.IS_REACT_ACT_ENVIRONMENT
    delete globalThis.window
    delete globalThis.document
    delete globalThis.HTMLElement
    delete globalThis.Node
  })

  it('renders Bootstrap 3 panel sections without legacy react-bootstrap context', () => {
    act(() => {
      root.render(h(
        Panel,
        { bsStyle: 'primary', className: 'snippet-panel' },
        h(Panel.Heading, null, 'Files'),
        h(Panel.Body, null, 'Snippet body')
      ))
    })

    expect(container.querySelector('.panel').className).toContain('panel-primary')
    expect(container.querySelector('.panel').className).toContain('snippet-panel')
    expect(container.querySelector('.panel-heading').textContent).toBe('Files')
    expect(container.querySelector('.panel-body').textContent).toBe('Snippet body')
  })

  it('maps Collapse in={ true } to the Bootstrap open class', () => {
    act(() => {
      root.render(h(
        Collapse,
        { in: true, className: 'file-collapse' },
        h('div', null, 'Expanded file')
      ))
    })

    expect(container.querySelector('.collapse').className).toContain('in')
    expect(container.querySelector('.collapse').className).toContain('file-collapse')
    expect(container.textContent).toContain('Expanded file')
  })
})
