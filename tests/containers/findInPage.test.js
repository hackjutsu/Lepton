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
  let findResultListener
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
        findInPage: vi.fn(),
        onFindInPageRequest: vi.fn(listener => {
          findRequestListener = listener
          return vi.fn()
        }),
        onFindInPageResult: vi.fn(listener => {
          findResultListener = listener
          return vi.fn()
        }),
        stopFindInPage: vi.fn()
      }
    }
    container = document.getElementById('root')
    root = createRoot(container)

    act(() => {
      root.render(h(FindInPage, { bridge }))
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

  it('opens from Cmd/Ctrl+F and sends the query only to local page find', () => {
    expect(container.querySelector('.find-in-page')).toBeNull()

    openWithShortcut()

    const input = typeQuery('fixture')
    expect(document.activeElement).toBe(input)
    expect(bridge.window.findInPage).not.toHaveBeenCalled()

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(bridge.window.findInPage).toHaveBeenLastCalledWith('fixture', {
      findNext: true,
      forward: true
    })

    document.getElementById('outside').focus()
    act(() => {
      findResultListener({ activeMatchOrdinal: 2, finalUpdate: true, matches: 5, query: 'fixture' })
    })

    expect(container.querySelector('.find-in-page-count').textContent).toBe('2/5')
    expect(document.activeElement).toBe(input)
  })

  it('moves between matches and clears highlights when closed', () => {
    act(() => {
      findRequestListener()
    })
    const input = typeQuery('snippet')
    act(() => {
      vi.runOnlyPendingTimers()
    })
    const buttons = container.querySelectorAll('.find-in-page-button')

    act(() => {
      buttons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(bridge.window.findInPage).toHaveBeenLastCalledWith('snippet', {
      findNext: false,
      forward: true
    })

    act(() => {
      input.dispatchEvent(new window.KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        shiftKey: true
      }))
    })
    expect(bridge.window.findInPage).toHaveBeenLastCalledWith('snippet', {
      findNext: false,
      forward: false
    })

    const stopCallsBeforeClose = bridge.window.stopFindInPage.mock.calls.length

    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape'
      }))
    })

    expect(bridge.window.stopFindInPage).toHaveBeenCalledTimes(stopCallsBeforeClose + 1)
    expect(container.querySelector('.find-in-page')).toBeNull()
  })

  it('debounces typing and ignores stale or incomplete native find results', () => {
    openWithShortcut()

    typeQuery('f')
    typeQuery('fi')
    typeQuery('fixture')

    expect(bridge.window.findInPage).not.toHaveBeenCalled()
    expect(bridge.window.stopFindInPage).not.toHaveBeenCalled()

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(bridge.window.findInPage).toHaveBeenCalledTimes(1)
    expect(bridge.window.findInPage).toHaveBeenCalledWith('fixture', {
      findNext: true,
      forward: true
    })

    act(() => {
      findResultListener({ activeMatchOrdinal: 1, finalUpdate: true, matches: 2, query: 'fi' })
      findResultListener({ activeMatchOrdinal: 1, finalUpdate: false, matches: 2, query: 'fixture' })
    })
    expect(container.querySelector('.find-in-page-count').textContent).toBe('0/0')

    act(() => {
      findResultListener({ activeMatchOrdinal: 1, finalUpdate: true, matches: 7, query: 'fixture' })
    })
    expect(container.querySelector('.find-in-page-count').textContent).toBe('1/7')
  })

  it('does not clear native highlights for every backspace', () => {
    openWithShortcut()
    typeQuery('fixture')
    act(() => {
      vi.runOnlyPendingTimers()
    })

    typeQuery('fixtur')
    typeQuery('fixtu')
    typeQuery('fixt')

    expect(bridge.window.stopFindInPage).not.toHaveBeenCalled()
    expect(bridge.window.findInPage).toHaveBeenCalledTimes(1)

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(bridge.window.findInPage).toHaveBeenCalledTimes(2)
    expect(bridge.window.findInPage).toHaveBeenLastCalledWith('fixt', {
      findNext: true,
      forward: true
    })
  })

  it('restores input focus after clearing the query', async () => {
    let finishClear
    bridge.window.stopFindInPage.mockReturnValueOnce(new Promise(resolve => {
      finishClear = resolve
    }))

    openWithShortcut()
    const input = typeQuery('fixture')
    typeQuery('')
    document.getElementById('outside').focus()

    expect(document.activeElement).not.toBe(input)

    await act(async () => {
      finishClear()
      await Promise.resolve()
    })

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
