'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import HighlightJS from 'highlight'
import './index.scss'
import '../../lib/vendor/styles/vs.css'

const hl = HighlightJS.Highlight

class Snippet extends Component {

  createMarkup (content) {
    let html = '<pre><code>' + hl(content) + '</code></pre>'
    return {__html: html}
  }

  render () {
    let activeSnippet = this.props.gists[this.props.activeGist]
    if (!activeSnippet.details) {
      return (
        <div className='snippet-box'>
          <div className='snippet-code'>
            <p>'Loading...'</p>
          </div>
        </div>
      )
    }

    let files = []
    let fileList = activeSnippet.details.files
    for (let key in fileList) {
      if (fileList.hasOwnProperty(key)) {
        let gistFile = fileList[key]

        files.push(
          <div key={ key }>
            <div>{ gistFile.filename }</div>
            <div>{ gistFile.language }</div>
            <div className='code-area' dangerouslySetInnerHTML={ this.createMarkup(gistFile.content) } />
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <div className='snippet-code'>
          <a href={ activeSnippet.details.html_url }>{ activeSnippet.details.description }</a>
          { files }
        </div>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    gists: state.gists,
    activeGist: state.activeGist
  }
}

export default connect(mapStateToProps)(Snippet)
