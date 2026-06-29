import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import Modal from '../../app/containers/compatModal'

const h = React.createElement

describe('React 19 modal compatibility', () => {
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

  it('renders and unmounts an overlay modal without legacy findDOMNode support', () => {
    const onHide = vi.fn()

    expect(() => {
      act(() => {
        root.render(h(
          Modal,
          { show: true, onHide },
          h(Modal.Header, { closeButton: true }, h(Modal.Title, null, 'Edit gist')),
          h(Modal.Body, null, 'Editor body')
        ))
      })
    }).not.toThrow()

    expect(document.body.textContent).toContain('Edit gist')
    expect(document.body.classList.contains('modal-open')).toBe(true)

    act(() => {
      document.querySelector('button.close').dispatchEvent(new window.MouseEvent('click', {
        bubbles: true
      }))
    })

    expect(onHide).toHaveBeenCalledTimes(1)

    expect(() => {
      act(() => {
        root.render(h(
          Modal,
          { show: false, onHide },
          h(Modal.Body, null, 'Editor body')
        ))
      })
    }).not.toThrow()

    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('keeps Escape handling compatible with react-bootstrap modal props', () => {
    const onHide = vi.fn()

    act(() => {
      root.render(h(
        Modal,
        { show: true, onHide },
        h(Modal.Body, null, 'Modal body')
      ))
    })

    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        bubbles: true,
        keyCode: 27
      }))
    })

    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it('renders static Modal.Dialog markup for login and search views', () => {
    act(() => {
      root.render(h(
        Modal.Dialog,
        { bsSize: 'large' },
        h(Modal.Body, null, 'Search results')
      ))
    })

    expect(container.querySelector('.modal')).not.toBeNull()
    expect(container.querySelector('.modal-dialog').className).toContain('modal-lg')
    expect(container.textContent).toContain('Search results')
  })
})
