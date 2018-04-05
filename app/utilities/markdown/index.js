'use strict'

import HighlightJS from 'highlight.js'
import MarkdownIt from 'markdown-it'
import MdTaskList from 'markdown-it-task-lists'
import MdKatex from 'markdown-it-katex'

// Configure markdown-it
const Md = MarkdownIt({
  highlight: (str, lang) => {
    return HighlightJS.highlightAuto(str).value
  }
})
  .use(MdTaskList)
  .use(MdKatex, {'throwOnError': false, 'errorColor': ' #cc0000'})

export default Md
