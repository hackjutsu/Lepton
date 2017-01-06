'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Panel, Button } from 'react-bootstrap'
import HighlightJS from 'highlight.js'
import Shell from 'shell'
import './index.scss'
import '../../lib/vendor/highlightJS/styles/github.css'

class Snippet extends Component {

  createMarkup (content) {
    let html = '<pre><code>' + HighlightJS.highlightAuto(content).value + '</code></pre>'
    return { __html: html }
  }

  renderPanelHeader (activeSnippet) {
    return (
      <div className='header-table'>
      <div className='line'>
        <div className='header-title'>{ activeSnippet.details.public ? 'public gist' : 'secret gist' }</div>
        <a
          href='#'
          className='open-revisions-button'
          onClick={ Shell.openExternal.bind(this, activeSnippet.details.html_url + '/revisions') }>
          revisions
        </a>
      </div>
      </div>
    )
  }

  render () {
    let activeSnippet = this.props.gists[this.props.activeGist]
    if (!activeSnippet || !activeSnippet.details) {
      return (
        <div className='snippet-box'>
          <div className='snippet-code'></div>
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
            <hr/>
            <div className='file-name'><b>{ gistFile.filename }</b></div>
            <div className='code-area' dangerouslySetInnerHTML={ this.createMarkup(gistFile.content) } ></div>
          </div>
        )
      }
    }

    // <button className='open-revisons-button' type="button" onClick={ Shell.openExternal.bind(this, activeSnippet.details.html_url + '/revisions') } >
    //   View Revisions
    // </button>

    return (
      <div className='snippet-box'>
        <Panel className='snippet-code'
          bsStyle={ activeSnippet.details.public ? 'success' : 'danger' }
          header={ this.renderPanelHeader(activeSnippet) }>
          <p>{ activeSnippet.details.description }</p>
          { files }
        </Panel>
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
