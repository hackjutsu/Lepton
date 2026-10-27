import HighlightJS from 'highlight.js'
import hljsDefineSolidity from 'highlightjs-solidity'
import hljsDefineGraphQL from 'highlightjs-graphql'
import AsciiDoc from '../../utilities/asciidoc'
import Markdown from '../../utilities/markdown'
import React, { Component } from 'react'
import electronBridge from '../../utilities/electronBridge'
import { adaptedLanguage, highlightContent } from './highlighting'
import { getHighlightTheme } from '../../utilities/themeManager'
import { t } from '../../utilities/i18n'

import 'katex/dist/katex.min.css'
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
  constructor (props) {
    super(props)
    this.codeAreaNode = null
    this.handleMarkdownImageError = this.handleMarkdownImageError.bind(this)
  }

  componentDidMount () {
    if (this.codeAreaNode) {
      this.codeAreaNode.addEventListener('error', this.handleMarkdownImageError, true)
    }
    this.initializeMarkdownImageFallbacks()
  }

  componentDidUpdate () {
    this.initializeMarkdownImageFallbacks()
  }

  componentWillUnmount () {
    if (this.codeAreaNode) {
      this.codeAreaNode.removeEventListener('error', this.handleMarkdownImageError, true)
    }
  }

  initializeMarkdownImageFallbacks () {
    if (!this.codeAreaNode) return

    const images = Array.from(this.codeAreaNode.querySelectorAll('img.lepton-markdown-image'))
    images.forEach(image => {
      if (
        image.classList.contains('lepton-markdown-missing-image') ||
        (image.hasAttribute('src') && image.complete && image.naturalWidth === 0)
      ) {
        this.showMarkdownImageFallback(image)
      }
    })
  }

  handleMarkdownImageError (event) {
    const image = event.target
    if (
      !image ||
      image.tagName !== 'IMG' ||
      !image.classList.contains('lepton-markdown-image')
    ) {
      return
    }

    this.showMarkdownImageFallback(image)
  }

  showMarkdownImageFallback (image) {
    const existingFallback = image.nextElementSibling
    if (
      existingFallback &&
      existingFallback.classList.contains('lepton-markdown-image-placeholder')
    ) {
      image.remove()
      return
    }

    const document = image.ownerDocument
    const fallback = document.createElement('span')
    const message = document.createElement('span')
    const alt = image.getAttribute('alt') || ''
    const reference = image.getAttribute('data-lepton-image-reference') || ''
    const filename = image.getAttribute('data-lepton-image-filename') || ''

    fallback.className = 'lepton-markdown-image-placeholder'
    message.className = 'lepton-markdown-image-placeholder-message'
    message.setAttribute('role', 'status')
    message.textContent = t('editor.imageUnavailable')
    fallback.appendChild(message)

    if (alt) {
      const altText = document.createElement('span')
      altText.className = 'lepton-markdown-image-placeholder-alt'
      altText.textContent = alt
      fallback.appendChild(altText)
    }

    if (reference && reference !== alt) {
      const referenceText = document.createElement('span')
      referenceText.className = 'lepton-markdown-image-placeholder-reference'
      referenceText.textContent = reference
      fallback.appendChild(referenceText)
    }

    const hasOpenAction = Boolean(filename && this.props.onSiblingImageOpen)
    if (hasOpenAction) {
      const openButton = document.createElement('button')
      openButton.type = 'button'
      openButton.className = 'lepton-markdown-image-open'
      openButton.setAttribute('data-lepton-image-filename', filename)
      openButton.textContent = t('editor.imageOpenFile')
      fallback.appendChild(openButton)
    }

    const enclosingLink = hasOpenAction && image.closest && image.closest('a')
    const linkContainsOnlyImage = enclosingLink && Array.from(enclosingLink.childNodes).every(node => {
      return node === image || (node.nodeType === 3 && !node.textContent.trim())
    })

    if (!enclosingLink) {
      image.replaceWith(fallback)
    } else if (linkContainsOnlyImage) {
      enclosingLink.replaceWith(fallback)
    } else {
      const insertionPoint = enclosingLink || image
      insertionPoint.insertAdjacentElement('afterend', fallback)
      image.remove()
    }
  }

  handleMarkdownImageOpenClicked (event) {
    const { onSiblingImageOpen } = this.props
    const target = event.target
    const button = target && target.closest
      ? target.closest('.lepton-markdown-image-open')
      : null
    if (!button || !event.currentTarget.contains(button) || !onSiblingImageOpen) return

    const filename = button.getAttribute('data-lepton-image-filename')
    if (!filename) return

    event.preventDefault()
    onSiblingImageOpen(filename)
  }

  handleCodeAreaClicked (event) {
    this.handleMarkdownTaskListItemClicked(event)
    this.handleMarkdownImageOpenClicked(event)
  }

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

  createMarkdownCodeBlock (content, siblingFiles) {
    return `<div class='markdown-section'>${Markdown.render(content, { siblingFiles })}</div>`
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

  renderCodeArea (filename, content, lang, kTabLength, siblingFiles) {
    const language = adaptedLanguage(filename, lang)
    let htmlContent = ''
    switch (language) {
      case 'Jupyter Notebook':
        htmlContent = this.createJupyterNotebookCodeBlock(content, language, kTabLength)
        break
      case 'Markdown':
        htmlContent = this.createMarkdownCodeBlock(content, siblingFiles)
        break
      case 'AsciiDoc':
        htmlContent = this.createAsciiDocCodeBlock(content, language, kTabLength)
        break
      default:
        htmlContent = this.createHighlightedCodeBlock(content, language, kTabLength)
    }
    return (
      <div className='code-area'
        ref={ node => { this.codeAreaNode = node } }
        onClick={ this.handleCodeAreaClicked.bind(this) }
        dangerouslySetInnerHTML={ { __html: htmlContent } }/>
    )
  }

  render () {
    const { filename, content, language, kTabLength, siblingFiles } = this.props
    return this.renderCodeArea(filename, content, language, kTabLength, siblingFiles)
  }
}
