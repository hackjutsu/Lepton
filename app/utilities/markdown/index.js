import HighlightJS from 'highlight.js'
import MarkdownIt from 'markdown-it'
import { full as MdEmoji } from 'markdown-it-emoji'
import MdTaskList from 'markdown-it-task-lists'
import MdKatex from 'markdown-it-katex'
import sanitizeHtml, { sanitizeInlineHtml } from './sanitizeHtml'

const htmlTagPattern = /<[!/a-z].*?>/ig
const punctuationPattern = /[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g
const taskListCheckboxPattern = /^<input class="task-list-item-checkbox"( checked="")?type="checkbox">$/

function getHeadingText (token) {
  if (!token) return ''
  if (!token.children) return token.content

  return token.children.map(child => {
    return child.type === 'html_inline'
      ? child.content.replace(htmlTagPattern, '')
      : child.content
  }).join('')
}

function createHeadingId (text) {
  const id = text
    .trim()
    .toLowerCase()
    .replace(htmlTagPattern, '')
    .replace(punctuationPattern, '')
    .replace(/\s+/g, '-')

  return id || 'heading'
}

function createUniqueHeadingId (id, env) {
  const renderEnv = env || {}

  if (!renderEnv.headingIds) {
    renderEnv.headingIds = Object.create(null)
  }

  const count = renderEnv.headingIds[id] || 0
  renderEnv.headingIds[id] = count + 1
  return count === 0 ? id : `${id}-${count}`
}

function isTaskListItemToken (token) {
  if (!token || !token.attrGet) return false

  return /\btask-list-item\b/.test(token.attrGet('class') || '')
}

function markTaskListCheckboxes (state) {
  state.tokens.forEach((token, idx, tokens) => {
    if (!token.children || !isTaskListItemToken(tokens[idx - 2])) return

    const firstChild = token.children[0]
    if (!firstChild || !taskListCheckboxPattern.test(firstChild.content)) return

    firstChild.type = 'task_list_checkbox'
  })
}

// Configure markdown-it
const Md = MarkdownIt({
  html: true,
  linkify: true,
  highlight: (str, lang) => {
    if (lang && HighlightJS.getLanguage(lang)) {
      try {
        return HighlightJS.highlight(lang, str).value
      } catch (__) {}
    }
    return HighlightJS.highlightAuto(str).value
  }
})
  .use(MdEmoji)
  .use(MdTaskList, { enabled: true })
  .use(MdKatex, { throwOnError: false, errorColor: ' #cc0000' })

Md.core.ruler.after('github-task-lists', 'lepton-task-list-checkboxes', markTaskListCheckboxes)

Md.renderer.rules.html_block = (tokens, idx) => sanitizeHtml(tokens[idx].content)
Md.renderer.rules.html_inline = (tokens, idx) => sanitizeInlineHtml(tokens[idx].content)
Md.renderer.rules.task_list_checkbox = (tokens, idx) => {
  return taskListCheckboxPattern.test(tokens[idx].content) ? tokens[idx].content : ''
}

Md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const headingText = getHeadingText(tokens[idx + 1])
  const headingId = createUniqueHeadingId(createHeadingId(headingText), env)

  tokens[idx].attrSet('id', headingId)
  return self.renderToken(tokens, idx, options)
}

export default Md
