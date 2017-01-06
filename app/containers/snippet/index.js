'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Panel, Modal } from 'react-bootstrap'
import HighlightJS from 'highlight.js'
import Shell from 'shell'
import './index.scss'
import '../../lib/vendor/highlightJS/styles/github.css'

class Snippet extends Component {

  constructor (props) {
    super(props)
    this.state = {
      showRaw: false,
      rawFile: null,
      rawContent: null
    }
  }

  closeRawModal () {
    this.setState({
      showRaw: false,
      rawFile: null,
      rawContent: null
    })
  }

  showRawModal (gist) {
    this.setState({
      showRaw: true,
      rawFile: gist.filename,
      rawContent: gist.content
    })
  }

  renderRawModal () {
    return (
      <Modal show={ this.state.showRaw } onHide={ this.closeRawModal.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>{ this.state.rawFile }</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className='code-area'>
            { this.state.rawContent }
          </div>
        </Modal.Body>
      </Modal>
    )
  }

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
          className='customized-button'
          onClick={ Shell.openExternal.bind(this, activeSnippet.details.html_url + '/revisions') }>
          #revisions
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
            <div className='file-name'>
              <b>{ gistFile.filename }</b>
              <a href='#' className='customized-button' onClick={ this.showRawModal.bind(this, gistFile) }>#raw</a>
            </div>
            <div className='code-area' dangerouslySetInnerHTML={ this.createMarkup(gistFile.content) } ></div>
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <Panel className='snippet-code'
          bsStyle={ activeSnippet.details.public ? 'success' : 'danger' }
          header={ this.renderPanelHeader(activeSnippet) }>
          <p>{ activeSnippet.details.description }</p>
          { this.renderRawModal() }
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
