'use strict'

import React, { Component } from 'react'
import { remote } from 'electron'
import HighlightJS from 'highlight.js'
import Markdown from '../../utilities/markdown'
import nb from '../../utilities/jupyterNotebook'

import '../../utilities/vendor/prism/prism.scss'
import '../../utilities/vendor/highlightJS/styles/github-gist.css'

const logger = remote.getGlobal('logger')

export default class CodeArea extends Component {
  constructor (props) {
    super(props)
    this.state = { hasError: false }
  }

  componentDidCatch (error, info) {
    // Display fallback UI
    this.setState({ hasError: true })
    logger.debug(`-----> Failed to render CodeArea is ${error} ${info}`)
  }

  createJupyterNotebookCodeBlock (content, language, kTabLength) {
    if (this.state.hasError) return this.createHighlightedCodeBlock(content, language, kTabLength)
    const notebook = nb.parse(JSON.parse(content))
    const notebookHtml = notebook.render().outerHTML
    return `<div class='jupyterNotebook-section'>${notebookHtml}</div>`
  }

  createMarkdownCodeBlock (content) {
    return `<div class='markdown-section'>${Markdown.render(content)}</div>`
  }

  adjustTabLength (content, kTabLength) {
    return content.replace(/[\t]/g, kTabLength)
  }

  createHighlightedCodeBlock (content, language, kTabLength) {
    let lineNumber = 0
    const highlightedContent = HighlightJS.highlightAuto(this.adjustTabLength(content, kTabLength), [language]).value

    /*
      Highlight.js wraps comment blocks inside <span class='hljs-comment'></span>.
      However, when the multi-line comment block is broken down into diffirent
      table rows, only the first row, which is appended by the <span> tag, is
      highlighted. The following code fixes it by appending <span> to each line
      of the comment block.
    */
    const commentPattern = /<span class='hljs-comment'>(.|\n)*?<\/span>/g
    const adaptedHighlightedContent = highlightedContent.replace(commentPattern, data => {
      return data.replace(/\r?\n/g, () => {
        // Chromium is smart enough to add the closing </span>
        return "\n<span class='hljs-comment'>"
      })
    })

    const contentTable = adaptedHighlightedContent.split(/\r?\n/).map(lineContent => {
      return `<tr>
                <td class='line-number' data-pseudo-content=${++lineNumber}></td>
                <td>${lineContent}</td>
              </tr>`
    }).join('')

    return `<pre><code><table class='code-table'>${contentTable}</table></code></pre>`
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
