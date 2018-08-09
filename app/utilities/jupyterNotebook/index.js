'use strict'

const nb = require('notebookjs')
const Prism = require('prismjs')
const highlighter = (code, lang) => {
  if (typeof lang === 'undefined') lang = 'markup'
  if (!Prism.languages.hasOwnProperty(lang)) {
    try {
      require('prismjs/components/prism-' + lang + '.js')
    } catch (e) {
      Prism.languages[lang] = false
    }
  }
  return Prism.languages[lang] ? Prism.highlight(code, Prism.languages[lang]) : code
}
nb.highlighter = (text, pre, code, lang) => {
  const language = lang || 'text'
  pre.className = 'language-' + language
  if (typeof code !== 'undefined') {
    code.className = 'language-' + language
  }
  return highlighter(text, language)
}

export default nb
