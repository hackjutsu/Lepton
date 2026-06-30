import HighlightJS from 'highlight.js'
import hljsDefineSolidity from 'highlightjs-solidity'
import hljsDefineGraphQL from 'highlightjs-graphql'
import AsciiDoc from '../../utilities/asciidoc'
import Markdown from '../../utilities/markdown'
import React, { Component } from 'react'
import electronBridge from '../../utilities/electronBridge'
import { adaptedLanguage, highlightContent } from './highlighting'
import { getHighlightTheme } from '../../utilities/themeManager'

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

const highlightTheme = getHighlightTheme(conf.get('theme'))
switch (highlightTheme) {
  case 'github':
    require('../../utilities/vendor/highlightJS/styles/github.css')
    break
  case 'github-dark':
    require('../../utilities/vendor/highlightJS/styles/github-dark.css')
    break
  case 'atom-one-dark':
    require('../../utilities/vendor/highlightJS/styles/atom-one-dark.css')
    break
  case 'atom-one-light':
    require('../../utilities/vendor/highlightJS/styles/atom-one-light.css')
    break
  case 'solarized-light':
    require('../../utilities/vendor/highlightJS/styles/solarized-light.css')
    break
  case 'solarized-dark':
    require('../../utilities/vendor/highlightJS/styles/solarized-dark.css')
    break
  case 'dracula':
    require('../../utilities/vendor/highlightJS/styles/dracula.css')
    break
  case 'material':
    require('../../utilities/vendor/highlightJS/styles/material.css')
    break
  case 'ayu-dark':
    require('../../utilities/vendor/highlightJS/styles/ayu-dark.css')
    break
  default:
    require('../../utilities/vendor/highlightJS/styles/github-gist.css')
}

resolveHighlightLanguage(hljsDefineSolidity)(HighlightJS) // register solidity to hightlight.js
resolveHighlightLanguage(hljsDefineGraphQL)(HighlightJS) // register graphql to hightlight.js

export default class CodeArea extends Component {
  handleMarkdownTaskListItemClicked (event) {
    const { onMarkdownTaskListItemToggle } = this.props
    const target = event.target
    if (
      !onMarkdownTaskListItemToggle ||
      !target ||
      !target.classList ||
      !target.classList.contains('task-list-item-checkbox')
    ) {
      return
    }

    const checkboxes = Array.from(event.currentTarget.querySelectorAll('.task-list-item-checkbox'))
    const taskIndex = checkboxes.indexOf(target)
    if (taskIndex < 0) return

    const previousChecked = !target.checked
    target.disabled = true

    Promise.resolve(onMarkdownTaskListItemToggle(taskIndex, target.checked))
      .catch(() => {
        target.checked = previousChecked
      })
      .finally(() => {
        target.disabled = false
      })
  }

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

  createAsciiDocCodeBlock (content, language, kTabLength) {
    try {
      return `<div class='markdown-section asciidoc-section'>${AsciiDoc.render(content)}</div>`
    } catch (err) {
      logger.error(`Failed to render AsciiDoc content with err ${err}`)
      return this.createHighlightedCodeBlock(content, language, kTabLength)
    }
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
      case 'AsciiDoc':
        htmlContent = this.createAsciiDocCodeBlock(content, language, kTabLength)
        break
      default:
        htmlContent = this.createHighlightedCodeBlock(content, language, kTabLength)
    }
    return (
      <div className='code-area'
        onClick={ this.handleMarkdownTaskListItemClicked.bind(this) }
        dangerouslySetInnerHTML={ { __html: htmlContent } }/>
    )
  }

  render () {
    const { filename, content, language, kTabLength } = this.props
    return this.renderCodeArea(filename, content, language, kTabLength)
  }
}
