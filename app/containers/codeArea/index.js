import HighlightJS from 'highlight.js'
import hljsDefineSolidity from 'highlightjs-solidity'
import hljsDefineGraphQL from 'highlightjs-graphql'
import Markdown from '../../utilities/markdown'
import nb from '../../utilities/jupyterNotebook'
import React, { Component } from 'react'

import '../../utilities/vendor/prism/prism.scss'
import './jupyterNotebook.scss'
import './markdown.scss'

const remote = require('@electron/remote')

const logger = remote.getGlobal('logger')
const conf = remote.getGlobal('conf')

// resolve syntax highlight style based on app theme
if (conf.get('theme') === 'dark') {
  require('../../utilities/vendor/highlightJS/styles/atom-one-dark.css')
} else {
  require('../../utilities/vendor/highlightJS/styles/github-gist.css')
}

hljsDefineSolidity(HighlightJS) // register solidity to hightlight.js
hljsDefineGraphQL(HighlightJS) // register graphql to hightlight.js

export default class CodeArea extends Component {
  createJupyterNotebookCodeBlock (content, language, kTabLength) {
    try {
      const notebook = nb.parse(JSON.parse(content))
      const notebookHtml = notebook.render().outerHTML
      return `<div class='jupyterNotebook-section'>${notebookHtml}</div>`
    } catch (err) {
      logger.error(`Failed to render Jupyter Notebook content with err ${err}`)
      return this.createHighlightedCodeBlock(content, language, kTabLength)
    }
  }

  createMarkdownCodeBlock (content) {
    return `<div class='markdown-section'>${Markdown.render(content)}</div>`
  }

  createHighlightedCodeBlock (content, language, kTabLength) {
    let lineNumber = 0
    const highlightedContent = HighlightJS.highlightAuto(content, [language]).value

    /*
      Highlight.js wraps comment blocks inside <span class='hljs-comment'></span>.
      However, when the multi-line comment block is broken down into different
      table rows, only the first row, which is appended by the <span> tag, is
      highlighted. The following code fixes it by appending <span> to each line
      of the comment block.
    */
    const commentPattern = /<span class="hljs-comment">(.|\n)*?\*\/\s*<\/span>/g
    const adaptedHighlightedContent = highlightedContent.replace(commentPattern, data => {
      return data.replace(/\r?\n/g, () => {
        // Chromium is smart enough to add the closing </span>
        return "\n<span class='hljs-comment'>"
      })
    })

    const contentTable = adaptedHighlightedContent.split(/\r?\n/).map(lineContent => {
      return `<tr>
                <td class='line-number' data-pseudo-content=${++lineNumber}></td>
                <td>${lineContent === '' ? '\n' : lineContent}</td>
              </tr>`
    }).join('')

    return `<pre><code><table class='code-table' style='tab-size: ${kTabLength};'>${contentTable}</table></code></pre>`
  }

  // Find the best language for code highlighting by best effort.
  adaptedLanguage (filename, lang) {
    let language = lang || 'Other'

    // Adjust the language based on file extensions.
    const filenameExtension = filename.split('.').pop()
    switch (filenameExtension) {
      case 'leptonrc':
        language = 'json'
        break
      case 'zshrc':
        language = 'bash'
        break
      case 'sql':
        language = 'sql'
        break
      case 'solidity':
      case 'sol':
        language = 'solidity'
        break
      default:
      // intentionally left blank
    }

    //  Adapt the language name for Highlight.js. For example, 'C#' should be
    //  expressed as 'cs' to be recognized by Highlight.js.
    switch (language) {
      case 'Shell': return 'bash'
      case 'C#': return 'cs'
      case 'Objective-C': return 'objectivec'
      case 'Objective-C++': return 'objectivec'
      case 'Visual Basic': return 'vbscript'
      case 'Batchfile': return 'bat'
      default:
    }

    return language
  }

  renderCodeArea (filename, content, lang, kTabLength) {
    const language = this.adaptedLanguage(filename, lang)
    let htmlContent = ''
    switch (language) {
      case 'Jupyter Notebook':
        htmlContent = this.createJupyterNotebookCodeBlock(content, language, kTabLength)
        break
      case 'Markdown':
        htmlContent = this.createMarkdownCodeBlock(content)
        break
      default:
        htmlContent = this.createHighlightedCodeBlock(content, language, kTabLength)
    }
    return (
      <div className='code-area'
        dangerouslySetInnerHTML={ { __html: htmlContent } }/>
    )
  }

  render () {
    const { filename, content, language, kTabLength } = this.props
    return this.renderCodeArea(filename, content, language, kTabLength)
  }
}
