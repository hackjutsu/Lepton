import darkTheme from './themes/darkTheme.json';
import lightTheme from './themes/lightTheme.json';

const LIGHT_THEME = 'light'
const DARK_THEME = 'dark'

class ThemeManager {
  constructor () {
    this.currentTheme = null
    this.root = document.querySelector(':root')

    this.themeMap = {
      [DARK_THEME]: darkTheme,
      [LIGHT_THEME]: lightTheme
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
