'use strict'

import Markdown from '../markdown'

const nb = require('notebookjs')
nb.markdown = (data) => Markdown.render(data)

export default class JN {
  // To match the pattern of the Markdown renderer
  static render (content) {
    const ipynb = JSON.parse(content)
    const notebook = nb.parse(ipynb)
    return notebook.render().outerHTML
  }
}
