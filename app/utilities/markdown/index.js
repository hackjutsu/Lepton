'use strict'

import HighlightJS from 'highlight.js'
import MarkdownIt from 'markdown-it'
import MdTaskList from 'markdown-it-task-lists'

// Configure markdown-it
const Md = MarkdownIt({
  highlight: function (str, lang) {
    return HighlightJS.highlightAuto(str).value
  }
})
Md.use(MdTaskList)

export default Md
