import darkTheme from './themes/darkTheme.json'
import lightTheme from './themes/lightTheme.json'

const LIGHT_THEME = 'light'
const DARK_THEME = 'dark'
const ONE_DARK_THEME = 'one-dark'
const ATOM_ONE_DARK_THEME = 'atom-one-dark'
const GITHUB_LIGHT_THEME = 'github-light'
const GITHUB_DARK_THEME = 'github-dark'
const CATPPUCCIN_LATTE_THEME = 'catppuccin-latte'
const CATPPUCCIN_MOCHA_THEME = 'catppuccin-mocha'
const SOLARIZED_LIGHT_THEME = 'solarized-light'
const SOLARIZED_DARK_THEME = 'solarized-dark'
const DRACULA_THEME = 'dracula'
const MATERIAL_THEME = 'material-theme'
const AYU_THEME = 'ayu'

const darkThemes = [
  DARK_THEME,
  ONE_DARK_THEME,
  ATOM_ONE_DARK_THEME,
  GITHUB_DARK_THEME,
  CATPPUCCIN_MOCHA_THEME,
  SOLARIZED_DARK_THEME,
  DRACULA_THEME,
  MATERIAL_THEME,
  AYU_THEME
]

const oneDarkTheme = Object.assign({}, darkTheme, {
  'bg-primary': '#282c34',
  'bg-secondary': '#21252b',
  'text-bg-primary': '#282c34',
  'border-color': '#3e4451',
  'text-primary': '#abb2bf',
  'text-secondary': '#9da5b4',
  'text-secondary-darken': '#828997',
  'text-code-block': '#abb2bf',
  'accent-regular': '#61afef',
  'shadow-color': 'rgba(0, 0, 0, 0.55)',
  'md-inline-code-background': '#3a3f4b'
})

const githubLightTheme = Object.assign({}, lightTheme, {
  'bg-primary': '#ffffff',
  'bg-secondary': '#f6f8fa',
  'text-bg-primary': '#ffffff',
  'border-color': '#d0d7de',
  'text-primary': '#24292f',
  'text-secondary': '#57606a',
  'text-secondary-darken': '#24292f',
  'text-invert': '#ffffff',
  'text-code-block': '#24292f',
  'accent-success': '#1a7f37',
  'accent-warning': '#9a6700',
  'accent-regular': '#0969da',
  'shadow-color': 'rgba(31, 35, 40, 0.18)',
  'modal-close-button': '#24292f',
  'md-inline-code-background': '#f6f8fa'
})

const githubDarkTheme = Object.assign({}, darkTheme, {
  'bg-primary': '#0d1117',
  'bg-secondary': '#161b22',
  'text-bg-primary': '#0d1117',
  'border-color': '#30363d',
  'text-primary': '#c9d1d9',
  'text-secondary': '#8b949e',
  'text-secondary-darken': '#f0f6fc',
  'text-invert': '#0d1117',
  'text-code-block': '#c9d1d9',
  'accent-success': '#3fb950',
  'accent-warning': '#d29922',
  'accent-regular': '#58a6ff',
  'shadow-color': 'rgba(1, 4, 9, 0.85)',
  'modal-close-button': '#c9d1d9',
  'md-inline-code-background': '#161b22'
})

const catppuccinLatteTheme = Object.assign({}, lightTheme, {
  'bg-primary': '#eff1f5',
  'bg-secondary': '#e6e9ef',
  'text-bg-primary': '#eff1f5',
  'border-color': '#ccd0da',
  'text-primary': '#4c4f69',
  'text-secondary': '#6c6f85',
  'text-secondary-darken': '#5c5f77',
  'text-invert': '#eff1f5',
  'text-code-block': '#4c4f69',
  'accent-regular': '#8839ef',
  'shadow-color': 'rgba(76, 79, 105, 0.25)',
  'modal-close-button': '#4c4f69',
  'md-inline-code-background': '#e6e9ef'
})

const catppuccinMochaTheme = Object.assign({}, darkTheme, {
  'bg-primary': '#1e1e2e',
  'bg-secondary': '#181825',
  'text-bg-primary': '#1e1e2e',
  'border-color': '#45475a',
  'text-primary': '#cdd6f4',
  'text-secondary': '#a6adc8',
  'text-secondary-darken': '#9399b2',
  'text-invert': '#1e1e2e',
  'text-code-block': '#cdd6f4',
  'accent-regular': '#cba6f7',
  'shadow-color': 'rgba(0, 0, 0, 0.55)',
  'modal-close-button': '#cdd6f4',
  'md-inline-code-background': '#313244'
})

const solarizedLightTheme = Object.assign({}, lightTheme, {
  'bg-primary': '#fdf6e3',
  'bg-secondary': '#eee8d5',
  'text-bg-primary': '#fdf6e3',
  'border-color': '#d6d0bd',
  'text-primary': '#657b83',
  'text-secondary': '#586e75',
  'text-secondary-darken': '#073642',
  'text-invert': '#fdf6e3',
  'text-code-block': '#657b83',
  'accent-success': '#859900',
  'accent-warning': '#b58900',
  'accent-regular': '#268bd2',
  'shadow-color': 'rgba(0, 43, 54, 0.2)',
  'modal-close-button': '#586e75',
  'md-inline-code-background': '#eee8d5'
})

const solarizedDarkTheme = Object.assign({}, darkTheme, {
  'bg-primary': '#002b36',
  'bg-secondary': '#073642',
  'text-bg-primary': '#002b36',
  'border-color': '#0f4552',
  'text-primary': '#839496',
  'text-secondary': '#657b83',
  'text-secondary-darken': '#93a1a1',
  'text-invert': '#002b36',
  'text-code-block': '#93a1a1',
  'accent-success': '#859900',
  'accent-warning': '#b58900',
  'accent-regular': '#2aa198',
  'shadow-color': 'rgba(0, 0, 0, 0.55)',
  'modal-close-button': '#93a1a1',
  'md-inline-code-background': '#073642'
})

const draculaTheme = Object.assign({}, darkTheme, {
  'bg-primary': '#282a36',
  'bg-secondary': '#21222c',
  'text-bg-primary': '#282a36',
  'border-color': '#44475a',
  'text-primary': '#f8f8f2',
  'text-secondary': '#c5c8d3',
  'text-secondary-darken': '#bd93f9',
  'text-invert': '#282a36',
  'text-code-block': '#f8f8f2',
  'accent-regular': '#bd93f9',
  'shadow-color': 'rgba(0, 0, 0, 0.55)',
  'modal-close-button': '#f8f8f2',
  'md-inline-code-background': '#44475a'
})

const materialTheme = Object.assign({}, darkTheme, {
  'bg-primary': '#263238',
  'bg-secondary': '#1e272c',
  'text-bg-primary': '#263238',
  'border-color': '#37474f',
  'text-primary': '#eeffff',
  'text-secondary': '#b0bec5',
  'text-secondary-darken': '#80cbc4',
  'text-invert': '#263238',
  'text-code-block': '#eeffff',
  'accent-success': '#c3e88d',
  'accent-warning': '#ffcb6b',
  'accent-regular': '#80cbc4',
  'shadow-color': 'rgba(0, 0, 0, 0.55)',
  'modal-close-button': '#eeffff',
  'md-inline-code-background': '#37474f'
})

const ayuTheme = Object.assign({}, darkTheme, {
  'bg-primary': '#0a0e14',
  'bg-secondary': '#11151c',
  'text-bg-primary': '#0a0e14',
  'border-color': '#273747',
  'text-primary': '#b3b1ad',
  'text-secondary': '#626a73',
  'text-secondary-darken': '#e6b450',
  'text-invert': '#0a0e14',
  'text-code-block': '#b3b1ad',
  'accent-success': '#c2d94c',
  'accent-warning': '#e6b450',
  'accent-regular': '#39bae6',
  'shadow-color': 'rgba(0, 0, 0, 0.65)',
  'modal-close-button': '#b3b1ad',
  'md-inline-code-background': '#11151c'
})

export function isDarkTheme (theme) {
  return darkThemes.includes(theme)
}

export function getEditorTheme (theme) {
  switch (theme) {
    case CATPPUCCIN_LATTE_THEME:
      return 'base16-light'
    case SOLARIZED_LIGHT_THEME:
      return 'solarized light'
    case SOLARIZED_DARK_THEME:
      return 'solarized dark'
    case DRACULA_THEME:
      return 'dracula'
    case GITHUB_LIGHT_THEME:
      return 'github'
    case GITHUB_DARK_THEME:
      return 'github-dark'
    case ATOM_ONE_DARK_THEME:
      return 'one-dark'
    case MATERIAL_THEME:
      return 'material'
    case AYU_THEME:
      return 'ayu-dark'
    default:
      return isDarkTheme(theme) ? 'one-dark' : 'github'
  }
}

export function getHighlightTheme (theme) {
  switch (theme) {
    case GITHUB_LIGHT_THEME:
      return 'github'
    case GITHUB_DARK_THEME:
      return 'github-dark'
    case ATOM_ONE_DARK_THEME:
      return 'atom-one-dark'
    case CATPPUCCIN_LATTE_THEME:
      return 'atom-one-light'
    case SOLARIZED_LIGHT_THEME:
      return 'solarized-light'
    case SOLARIZED_DARK_THEME:
      return 'solarized-dark'
    case DRACULA_THEME:
      return 'dracula'
    case MATERIAL_THEME:
      return 'material'
    case AYU_THEME:
      return 'ayu-dark'
    default:
      return isDarkTheme(theme) ? 'atom-one-dark' : 'github-gist'
  }
}

class ThemeManager {
  constructor () {
    this.currentTheme = null
    this.root = document.querySelector(':root')

    this.themeMap = {
      [DARK_THEME]: darkTheme,
      [LIGHT_THEME]: lightTheme,
      [ONE_DARK_THEME]: oneDarkTheme,
      [ATOM_ONE_DARK_THEME]: oneDarkTheme,
      [GITHUB_LIGHT_THEME]: githubLightTheme,
      [GITHUB_DARK_THEME]: githubDarkTheme,
      [CATPPUCCIN_LATTE_THEME]: catppuccinLatteTheme,
      [CATPPUCCIN_MOCHA_THEME]: catppuccinMochaTheme,
      [SOLARIZED_LIGHT_THEME]: solarizedLightTheme,
      [SOLARIZED_DARK_THEME]: solarizedDarkTheme,
      [DRACULA_THEME]: draculaTheme,
      [MATERIAL_THEME]: materialTheme,
      [AYU_THEME]: ayuTheme
    }
  }

  setTheme (theme) {
    if (theme !== this.currentTheme && this.themeMap[theme]) {
      this.generateScheme(theme)
    }
  }

  toggleTheme () {
    const newTheme = this.currentTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME
    this.generateScheme(newTheme)
  }

  generateScheme (themeName) {
    this.currentTheme = themeName
    const themeColors = this.themeMap[themeName]

    for (const property in themeColors) {
      this.root.style.setProperty(`--${property}`, themeColors[property])
    }
  }
}

export default ThemeManager
