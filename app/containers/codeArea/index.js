'use strict'

import React, { Component } from 'react'
import { remote } from 'electron'
import HighlightJS from 'highlight.js'
import hljsDefineSolidity from 'highlightjs-solidity'
import Markdown from '../../utilities/markdown'
import nb from '../../utilities/jupyterNotebook'

import '../../utilities/vendor/prism/prism.scss'
import '../../utilities/vendor/highlightJS/styles/github-gist.css'
import './jupyterNotebook.scss'
import './markdown.scss'

const logger = remote.getGlobal('logger')
hljsDefineSolidity(HighlightJS) // register solidity to hightlight.js

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

  //  Adapt the language name for Highlight.js. For example, 'C#' should be
  //  expressed as 'cs' to be recognized by Highlight.js.
  adaptedLanguage (lang) {
    let language = lang || 'Other'

    switch (language) {
      case 'Shell': return 'Bash'
      case 'C#': return 'cs'
      case 'Objective-C': return 'objectivec'
      case 'Objective-C++': return 'objectivec'
      case 'Visual Basic': return 'vbscript'
      default:
    }
    return language
  }

  renderCodeArea (content, lang, kTabLength) {
    const language = this.adaptedLanguage(lang)
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
    const { content, language, kTabLength } = this.props
    return this.renderCodeArea(content, language, kTabLength)
  }
}
