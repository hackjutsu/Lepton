import { describe, expect, it } from 'vitest'

import {
  getEditorTheme,
  getHighlightTheme,
  isDarkTheme
} from '../../app/utilities/themeManager'

describe('theme manager utilities', () => {
  it('classifies dark themes', () => {
    expect(isDarkTheme('dark')).toBe(true)
    expect(isDarkTheme('one-dark')).toBe(true)
    expect(isDarkTheme('catppuccin-mocha')).toBe(true)
    expect(isDarkTheme('solarized-dark')).toBe(true)
    expect(isDarkTheme('dracula')).toBe(true)
    expect(isDarkTheme('light')).toBe(false)
    expect(isDarkTheme('catppuccin-latte')).toBe(false)
    expect(isDarkTheme('solarized-light')).toBe(false)
  })

  it('maps app themes to editor themes', () => {
    expect(getEditorTheme('dark')).toBe('one-dark')
    expect(getEditorTheme('catppuccin-latte')).toBe('base16-light')
    expect(getEditorTheme('catppuccin-mocha')).toBe('one-dark')
    expect(getEditorTheme('solarized-light')).toBe('solarized light')
    expect(getEditorTheme('solarized-dark')).toBe('solarized dark')
    expect(getEditorTheme('dracula')).toBe('dracula')
    expect(getEditorTheme('light')).toBe('github')
  })

  it('maps app themes to rendered code highlight themes', () => {
    expect(getHighlightTheme('dark')).toBe('atom-one-dark')
    expect(getHighlightTheme('catppuccin-latte')).toBe('atom-one-light')
    expect(getHighlightTheme('catppuccin-mocha')).toBe('atom-one-dark')
    expect(getHighlightTheme('solarized-light')).toBe('solarized-light')
    expect(getHighlightTheme('solarized-dark')).toBe('solarized-dark')
    expect(getHighlightTheme('dracula')).toBe('dracula')
    expect(getHighlightTheme('light')).toBe('github-gist')
  })
})
