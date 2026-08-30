import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import FindInPage, { isFindInPageAvailable } from '../../app/containers/findInPage'

const h = React.createElement

describe('find in page', () => {
  let bridge
  let container
  let findRequestListener
  let finder
  let root

  beforeEach(() => {
    vi.useFakeTimers()
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><button id="outside">Outside</button></body></html>', {
      url: 'http://localhost'
    })

    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.Node = dom.window.Node
    dom.window.HTMLElement.prototype.attachEvent = () => {}
    dom.window.HTMLElement.prototype.detachEvent = () => {}

    bridge = {
      window: {
        onFindInPageRequest: vi.fn(listener => {
          findRequestListener = listener
          return vi.fn()
        })
      }
    }
    finder = {
      clear: vi.fn(),
      navigate: vi.fn(forward => ({
        activeMatchOrdinal: forward ? 2 : 3,
        matches: 3
      })),
      search: vi.fn(() => ({ activeMatchOrdinal: 1, matches: 5 }))
    }
    container = document.getElementById('root')
    root = createRoot(container)

    act(() => {
      root.render(h(FindInPage, { bridge, finder }))
    })
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
    vi.useRealTimers()
  })

  function openWithShortcut () {
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        bubbles: true,
        key: 'f',
        metaKey: true
      }))
    })
  }

  function typeQuery (query) {
    const input = container.querySelector('.find-in-page-input')
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    act(() => {
      valueSetter.call(input, query)
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    return input
  }

  it('opens from Cmd/Ctrl+F and searches only the local page', () => {
    expect(container.querySelector('.find-in-page')).toBeNull()

    openWithShortcut()

    const input = typeQuery('fixture')
    expect(document.activeElement).toBe(input)
    expect(finder.search).not.toHaveBeenCalled()

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(finder.search).toHaveBeenLastCalledWith('fixture')

    expect(container.querySelector('.find-in-page-count').textContent).toBe('1/5')
    expect(document.activeElement).toBe(input)
  })

  it('moves between matches and clears highlights when closed', () => {
    act(() => {
      findRequestListener()
    })
    const input = typeQuery('snippet')
    finder.search.mockReturnValueOnce({ activeMatchOrdinal: 1, matches: 3 })
    act(() => {
      vi.runOnlyPendingTimers()
    })
    const buttons = container.querySelectorAll('.find-in-page-button')

    act(() => {
      buttons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(finder.navigate).toHaveBeenLastCalledWith(true)
    expect(container.querySelector('.find-in-page-count').textContent).toBe('2/3')
    expect(document.activeElement).toBe(input)

    act(() => {
      input.dispatchEvent(new window.KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        shiftKey: true
      }))
    })
    expect(finder.navigate).toHaveBeenLastCalledWith(false)

    const clearCallsBeforeClose = finder.clear.mock.calls.length

    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape'
      }))
    })

    expect(finder.clear).toHaveBeenCalledTimes(clearCallsBeforeClose + 1)
    expect(container.querySelector('.find-in-page')).toBeNull()
  })

  it('debounces typing and applies only the latest query', () => {
    openWithShortcut()

    typeQuery('f')
    typeQuery('fi')
    typeQuery('fixture')

    expect(finder.search).not.toHaveBeenCalled()
    expect(finder.clear).toHaveBeenCalledTimes(3)

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(finder.search).toHaveBeenCalledTimes(1)
    expect(finder.search).toHaveBeenCalledWith('fixture')
    expect(container.querySelector('.find-in-page-count').textContent).toBe('1/5')
  })

  it('clears stale highlights immediately while debouncing backspace searches', () => {
    openWithShortcut()
    typeQuery('fixture')
    act(() => {
      vi.runOnlyPendingTimers()
    })

    typeQuery('fixtur')
    typeQuery('fixtu')
    typeQuery('fixt')

    expect(finder.clear).toHaveBeenCalledTimes(4)
    expect(finder.search).toHaveBeenCalledTimes(1)

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(finder.search).toHaveBeenCalledTimes(2)
    expect(finder.search).toHaveBeenLastCalledWith('fixt')
  })

  it('keeps input focus after clearing the query', () => {
    openWithShortcut()
    const input = typeQuery('fixture')
    typeQuery('')

    expect(finder.clear).toHaveBeenCalled()
    expect(document.activeElement).toBe(input)
  })

  it('is limited to the snippet-reading surface', () => {
    const activeSnippetState = {
      searchWindowStatus: 'OFF',
      userSession: { activeStatus: 'ACTIVE' }
    }

    expect(isFindInPageAvailable(activeSnippetState)).toBe(true)
    expect(isFindInPageAvailable(Object.assign({}, activeSnippetState, {
      searchWindowStatus: 'ON'
    }))).toBe(false)
    expect(isFindInPageAvailable(Object.assign({}, activeSnippetState, {
      aboutModalStatus: 'ON'
    }))).toBe(false)
    expect(isFindInPageAvailable({
      searchWindowStatus: 'OFF',
      userSession: { activeStatus: 'INACTIVE' }
    })).toBe(false)
  })
})
