import HighlightJS from 'highlight.js'

function shouldUsePhpTemplate (content, language) {
  return typeof language === 'string' &&
    language.toLowerCase() === 'php' &&
    /<\?(?:php|=)?/i.test(content)
}

export function highlightContent (content, language) {
  const highlightLanguage = shouldUsePhpTemplate(content, language) ? 'php-template' : language

  if (highlightLanguage && HighlightJS.getLanguage(highlightLanguage)) {
    try {
      return HighlightJS.highlight(content, { language: highlightLanguage, ignoreIllegals: true }).value
    } catch (__) {}
  }

  return HighlightJS.highlightAuto(content).value
}

export function adaptedLanguage (filename, lang) {
  let language = lang || 'Other'

  // Adjust the language based on file extensions.
  const filenameExtension = filename && filename.split('.').pop().toLowerCase()
  switch (filenameExtension) {
    case 'adoc':
    case 'asciidoc':
      language = 'AsciiDoc'
      break
    case 'c':
    case 'h':
      if (!lang) language = 'c'
      break
    case 'leptonrc':
      language = 'json'
      break
    case 'bat':
    case 'cmd':
      language = 'dos'
      break
    case 'zshrc':
      language = 'bash'
      break
    case 'py':
    case 'pyw':
      language = 'python'
      break
    case 'sql':
      language = 'sql'
      break
    case 'solidity':
    case 'sol':
      language = 'solidity'
      break
    case 'vue':
      language = 'xml'
      break
    default:
    // intentionally left blank
  }

  //  Adapt the language name for Highlight.js. For example, 'C#' should be
  //  expressed as 'cs' to be recognized by Highlight.js.
  switch (language) {
    case 'Shell': return 'bash'
    case 'Python': return 'python'
    case 'PHP': return 'php'
    case 'C': return 'c'
    case 'C++': return 'cpp'
    case 'C#': return 'cs'
    case 'Objective-C': return 'objectivec'
    case 'Objective-C++': return 'objectivec'
    case 'Visual Basic': return 'vbscript'
    case 'Batchfile': return 'dos'
    case 'Vue': return 'xml'
    default:
  }

  return language
}
