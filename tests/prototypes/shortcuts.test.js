import { describe, expect, it } from 'vitest'
import { matchesAccelerator, matchesSearchShortcut, nextZoomPercent, searchShortcutAllowed, zoomShortcutAction } from '../../prototypes/tauri/legacy/shortcuts'

function key (value, modifiers = {}) {
  return { key: value, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers }
}

describe('Tauri window shortcuts', () => {
  it('uses Command on macOS and Control on Windows and Linux', () => {
    expect(matchesAccelerator(key('s', { metaKey: true }), 'CommandOrControl+S', 'MacIntel')).toBe(true)
    expect(matchesAccelerator(key('s', { ctrlKey: true }), 'CommandOrControl+S', 'Win32')).toBe(true)
    expect(matchesAccelerator(key('s', { ctrlKey: true }), 'CommandOrControl+S', 'Linux x86_64')).toBe(true)
    expect(matchesAccelerator(key('s', { metaKey: true }), 'CommandOrControl+S', 'Win32')).toBe(false)
  })
  it('matches configured Shift+Space and platform delete keys', () => {
    expect(matchesAccelerator(key(' ', { shiftKey: true }), 'Shift+Space', 'MacIntel')).toBe(true)
    expect(matchesAccelerator(key('Backspace', { metaKey: true }), 'CommandOrControl+Delete', 'MacIntel')).toBe(true)
    expect(matchesAccelerator(key('Delete', { ctrlKey: true }), 'CommandOrControl+Delete', 'Win32')).toBe(true)
    expect(matchesAccelerator(key('s', { ctrlKey: true, shiftKey: true }), 'Ctrl+S', 'Win32')).toBe(false)
  })
  it('ignores absent or invalid accelerators', () => {
    expect(matchesAccelerator(key('s'), null, 'Linux')).toBe(false)
    expect(matchesAccelerator(key('s'), '', 'Linux')).toBe(false)
    expect(matchesAccelerator(key('s'), 'Unknown+S', 'Linux')).toBe(false)
  })

  it('leaves Shift+Space available for typing while supporting other configured shortcuts', () => {
    const field = { closest: () => ({}) }
    const body = { closest: () => null }
    const space = key(' ', { shiftKey: true })
    expect(searchShortcutAllowed({ ...space, target: body })).toBe(true)
    expect(searchShortcutAllowed({ ...space, target: field })).toBe(false)
    expect(searchShortcutAllowed({ ...space, target: { isContentEditable: true } })).toBe(false)
    expect(searchShortcutAllowed({ ...key('f', { metaKey: true, shiftKey: true }), target: field })).toBe(true)
  })

  it('supports both search shortcuts and an additional configured shortcut on each platform', () => {
    for (const [platform, modifier] of [['MacIntel', { metaKey: true }], ['Win32', { ctrlKey: true }], ['Linux x86_64', { ctrlKey: true }]]) {
      expect(matchesSearchShortcut(key(' ', { shiftKey: true }), 'Alt+S', platform)).toBe(true)
      expect(matchesSearchShortcut(key('f', { ...modifier, shiftKey: true }), 'Alt+S', platform)).toBe(true)
      expect(matchesSearchShortcut(key('s', { altKey: true }), 'Alt+S', platform)).toBe(true)
      expect(matchesSearchShortcut(key('f', modifier), 'Alt+S', platform)).toBe(false)
    }
  })

  it('recognizes native zoom keys on macOS, Windows and Linux', () => {
    for (const [platform, modifier] of [['MacIntel', { metaKey: true }], ['Win32', { ctrlKey: true }], ['Linux x86_64', { ctrlKey: true }]]) {
      expect(zoomShortcutAction(key('=', modifier), platform)).toBe('in')
      expect(zoomShortcutAction(key('+', { ...modifier, shiftKey: true }), platform)).toBe('in')
      expect(zoomShortcutAction(key('+', { ...modifier, code: 'NumpadAdd' }), platform)).toBe('in')
      expect(zoomShortcutAction(key('-', modifier), platform)).toBe('out')
      expect(zoomShortcutAction(key('0', modifier), platform)).toBe('reset')
      expect(zoomShortcutAction(key('Insert', { ...modifier, code: 'Numpad0' }), platform)).toBeNull()
      expect(zoomShortcutAction(key('=', { ...modifier, altKey: true }), platform)).toBeNull()
    }
    expect(zoomShortcutAction(key('=', { ctrlKey: true }), 'MacIntel')).toBeNull()
    expect(zoomShortcutAction(key('=', { metaKey: true }), 'Win32')).toBeNull()
    expect(zoomShortcutAction(key('=', { metaKey: true, ctrlKey: true }), 'MacIntel')).toBeNull()
  })

  it('uses Electron zoom steps with bounds and reset', () => {
    expect(nextZoomPercent(100, 'in')).toBe(120)
    expect(nextZoomPercent(120, 'out')).toBe(100)
    expect(nextZoomPercent(290, 'in')).toBe(300)
    expect(nextZoomPercent(55, 'out')).toBe(50)
    expect(nextZoomPercent(200, 'reset')).toBe(100)
  })
})
