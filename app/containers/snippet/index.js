'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Panel, Modal } from 'react-bootstrap'
import GistEditorForm from '../gistEditorForm'
import { UPDATE_GIST } from '../gistEditorForm'
import HighlightJS from 'highlight.js'
import { shell } from 'electron'
import './index.scss'
import '../../utilities/vendor/highlightJS/styles/github.css'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

class Snippet extends Component {

  constructor (props) {
    super(props)
    this.state = {
      showGistEditorModal: false,
      showRawModal: false,
      rawFile: null,
      rawContent: null,
      files: null
    }
  }

  showEditModal (details) {
    details && this.setState({
      showGistEditorModal: true,
      rawFile: null,
      rawContent: null
    })
  }

  closeEditModal () {
    this.setState({
      showGistEditorModal: false,
      rawFile: null,
      rawContent: null
    })
  }

  closeGistEditorModal () {
    this.setState({
      showGistEditorModal: false
    })
  }

  handleGistEditorFormSubmit (data) {
    logger.debug('Form submitted: ' + JSON.stringify(data))
  }

  renderGistEditorModalBody (description, fileArray, isPrivate) {
    logger.debug('Inside renderGistEditorModalBody')
    let initialData = Object.assign({
      description: description,
      gists: fileArray,
      private: isPrivate
    })

    logger.debug(UPDATE_GIST)

    return (
      <GistEditorForm
        initialData={ initialData }
        formStyle = { UPDATE_GIST }
        onSubmit={ this.handleGistEditorFormSubmit.bind(this) }/>
    )
  }

  renderGistEditorModal (description, fileArray, isPrivate) {
    logger.debug('Inside renderGistEditorModal')
    return (
      <Modal
        bsSize="large"
        show={ this.state.showGistEditorModal }
        onHide={ this.closeGistEditorModal.bind(this)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Gist</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          { this.renderGistEditorModalBody(description, fileArray, isPrivate) }
        </Modal.Body>
      </Modal>
    )
  }

  closeRawModal () {
    this.setState({
      showRawModal: false,
      rawFile: null,
      rawContent: null
    })
  }

  showRawModalModal (gist) {
    this.setState({
      showRawModal: true,
      rawFile: gist.filename,
      rawContent: gist.content
    })
  }

  renderRawModal () {
    return (
      <Modal
        className='edit-modal'
        show={ this.state.showRawModal }
        onHide={ this.closeRawModal.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>{ this.state.rawFile }</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <textarea className='code-area' defaultValue={ this.state.rawContent } />
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
        <div className='header-title'>
          { activeSnippet.brief.public ? 'public gist' : 'secret gist' }
        </div>
        <a className='customized-button'
          href='#'
          onClick={ this.showEditModal.bind(this, activeSnippet.details) }>
          #edit
        </a>
        <a className='customized-button'
          href='#'
          onClick={ shell.openExternal.bind(this, activeSnippet.brief.html_url + '/revisions') }>
          #revisions
        </a>
      </div>
      </div>
    )
  }

  render () {
    let activeSnippet = this.props.gists[this.props.activeGist]
    if (!activeSnippet) return null

    let fileHtmlArray = []
    let fileArray = []
    if (activeSnippet.details) {
      let fileList = activeSnippet.details.files
      for (let key in fileList) {
        let gistFile = fileList[key]
        fileArray.push(Object.assign({
          filename: gistFile.filename,
          content: gistFile.content
        }))
        fileHtmlArray.push(
          <div key={ key }>
            <hr/>
            <div className='file-name'>
              <b>{ gistFile.filename }</b>
              <a
                href='#'
                className='customized-button'
                onClick={ this.showRawModalModal.bind(this, gistFile) }>
                #raw
            </a>
            </div>
            <div
              className='code-area'
              dangerouslySetInnerHTML={ this.createMarkup(gistFile.content) }/>
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <Panel className='snippet-code'
          bsStyle={ activeSnippet.brief.public ? 'success' : 'danger' }
          header={ this.renderPanelHeader(activeSnippet) }>
          <p>{ activeSnippet.brief.description }</p>
          { this.renderGistEditorModal(activeSnippet.brief.description, fileArray, !activeSnippet.brief.public) }
          { this.renderRawModal() }
          { fileHtmlArray }
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
