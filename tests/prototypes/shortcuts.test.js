import { describe, expect, it } from 'vitest'
import { matchesAccelerator } from '../../prototypes/tauri/legacy/shortcuts'

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
})
