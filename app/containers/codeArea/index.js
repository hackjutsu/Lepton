import HighlightJS from 'highlight.js'
import hljsDefineSolidity from 'highlightjs-solidity'
import hljsDefineGraphQL from 'highlightjs-graphql'
import Markdown from '../../utilities/markdown'
import React, { Component } from 'react'
import electronBridge from '../../utilities/electronBridge'
import { adaptedLanguage, highlightContent } from './highlighting'

import '../../utilities/vendor/prism/prism.scss'
import './jupyterNotebook.scss'
import './markdown.scss'

const logger = electronBridge.logger
const conf = electronBridge.config

function resolveHighlightLanguage (languageModule) {
  if (typeof languageModule === 'function') return languageModule
  if (languageModule && typeof languageModule.default === 'function') return languageModule.default
  if (languageModule && typeof languageModule.definer === 'function') return languageModule.definer
  throw new TypeError('Invalid highlight.js language module')
}

// resolve syntax highlight style based on app theme
if (conf.get('theme') === 'dark') {
  require('../../utilities/vendor/highlightJS/styles/atom-one-dark.css')
} else {
  require('../../utilities/vendor/highlightJS/styles/github-gist.css')
}

resolveHighlightLanguage(hljsDefineSolidity)(HighlightJS) // register solidity to hightlight.js
resolveHighlightLanguage(hljsDefineGraphQL)(HighlightJS) // register graphql to hightlight.js

export default class CodeArea extends Component {
  createJupyterNotebookCodeBlock (content, language, kTabLength) {
    try {
      const result = electronBridge.notebook.render(content)
      if (!result.status) {
        throw new Error(result.error)
      }
      return `<div class='jupyterNotebook-section'>${result.html}</div>`
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
    const highlightedContent = highlightContent(content, language)

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

  renderCodeArea (filename, content, lang, kTabLength) {
    const language = adaptedLanguage(filename, lang)
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
