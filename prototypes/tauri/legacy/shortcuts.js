// Electron-style accelerators interpreted within the focused application window.
export function matchesAccelerator (event, accelerator, platform) {
  if (typeof accelerator !== 'string') return false
  const parts = accelerator.split('+').map(part => part.trim()).filter(Boolean)
  if (!parts.length) return false
  const key = parts.pop().toLowerCase()
  const modifiers = new Set(parts.map(part => part.toLowerCase()))
  const knownModifiers = new Set(['commandorcontrol', 'cmdorctrl', 'command', 'cmd', 'super', 'control', 'ctrl', 'alt', 'option', 'shift'])
  if ([...modifiers].some(modifier => !knownModifiers.has(modifier))) return false
  const mac = /mac|iphone|ipad/i.test(platform || '')
  const commandOrControl = modifiers.has('commandorcontrol') || modifiers.has('cmdorctrl')
  const meta = modifiers.has('command') || modifiers.has('cmd') || modifiers.has('super') || (commandOrControl && mac)
  const ctrl = modifiers.has('control') || modifiers.has('ctrl') || (commandOrControl && !mac)
  const alt = modifiers.has('alt') || modifiers.has('option')
  const shift = modifiers.has('shift')
  if (Boolean(event.metaKey) !== meta || Boolean(event.ctrlKey) !== ctrl || Boolean(event.altKey) !== alt || Boolean(event.shiftKey) !== shift) return false
  const actual = String(event.key || '').toLowerCase()
  if (key === 'space') return actual === ' ' || actual === 'spacebar' || event.code === 'Space'
  if (key === 'delete') return actual === 'delete' || actual === 'backspace'
  return actual === key
}

// Electron's View menu uses Command/Control with =, +, -, and 0 for zoom.
export function zoomShortcutAction (event, platform) {
  const mac = /mac|iphone|ipad/i.test(platform || '')
  if (event.altKey || Boolean(event.metaKey) !== mac || Boolean(event.ctrlKey) === mac) return null
  const key = String(event.key || '')
  if (key === '+' || key === '=' || event.code === 'NumpadAdd') return 'in'
  if (!event.shiftKey && (key === '-' || event.code === 'NumpadSubtract')) return 'out'
  if (!event.shiftKey && key === '0') return 'reset'
  return null
}

export function nextZoomPercent (current, action) {
  if (action === 'reset') return 100
  if (action !== 'in' && action !== 'out') return current
  return Math.min(300, Math.max(50, current * (action === 'in' ? 1.2 : 1 / 1.2)))
}
