import HighlightJS from 'highlight.js'
import MarkdownIt from 'markdown-it'
import { full as MdEmoji } from 'markdown-it-emoji'
import MdTaskList from 'markdown-it-task-lists'
import MdKatex from 'markdown-it-katex'
import sanitizeHtml, { sanitizeInlineHtml } from './sanitizeHtml'

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
  .use(MdTaskList)
  .use(MdKatex, { throwOnError: false, errorColor: ' #cc0000' })

Md.renderer.rules.html_block = (tokens, idx) => sanitizeHtml(tokens[idx].content)
Md.renderer.rules.html_inline = (tokens, idx) => sanitizeInlineHtml(tokens[idx].content)

export default Md
