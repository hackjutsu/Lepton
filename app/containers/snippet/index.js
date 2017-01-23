'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { Panel, Modal, Button } from 'react-bootstrap'
import GistEditorForm from '../gistEditorForm'
import { UPDATE_GIST } from '../gistEditorForm'
import HighlightJS from 'highlight.js'
import { shell, remote } from 'electron'
import Notifier from '../../utilities/notifier'
import HumanReadableTime from 'human-readable-time'
import './index.scss'
import '../../utilities/vendor/highlightJS/styles/github.css'

import {
  updateSingleGist,
  selectLangTag,
  updateLangTags } from '../../actions/index'

import {
  getGitHubApi,
  EDIT_SINGLE_GIST,
  DELETE_SINGLE_GIST
} from '../../utilities/gitHubApi'

const logger = remote.getGlobal('logger')

class Snippet extends Component {

  constructor (props) {
    super(props)
    this.state = {
      showDeleteModal: false,
      showGistEditorModal: false,
      showRawModal: false,
      rawFile: null,
      rawContent: null,
      files: null
    }
  }

  showDeleteModal () {
    this.setState({
      showDeleteModal: true
    })
  }

  closeDeleteModal () {
    this.setState({
      showDeleteModal: false
    })
  }

  handleDeleteClicked () {
    let { accessToken, activeGist } = this.props
    getGitHubApi(DELETE_SINGLE_GIST)(
      accessToken,
      activeGist)
    .catch(err => {
      logger.error('Failed to delete the gist ' + activeGist)
      logger.error(JSON.stringify(err))
      Notifier('Failed to delete the gist', JSON.stringify(err))
    })
    .then(data => {
      logger.info('The gist ' + activeGist + ' has been deleted.')
      Notifier('Gist deleted', 'The gist has been deleted')

      // For performance purpose, we should perform an internal update, like what
      // we're doing for creating/edit gists. However, since delete is an infrequent
      // operation, we decide to just call the resync method and keep the logic
      // simple.
      this.props.reSyncUserGists()
    })
    .finally(() => {
      this.closeDeleteModal()
    })
  }

  renderDeleteModal () {
    return (
      <div className="static-modal">
        <Modal show={ this.state.showDeleteModal } bsSize="small">
          <Modal.Header>
            <Modal.Title>Delete the gist?</Modal.Title>
          </Modal.Header>
          <Modal.Footer>
            <Button onClick={ this.closeDeleteModal.bind(this) }>cancel</Button>
            <Button
              bsStyle="danger"
              onClick={ this.handleDeleteClicked.bind(this) }>delete</Button>
          </Modal.Footer>
        </Modal>
      </div>
    )
  }

  showGistEditorModal (details) {
    details && this.setState({
      showGistEditorModal: true,
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
    let description = data.description
    let processedFiles = {}

    data.gistFiles.forEach((file) => {
      processedFiles[file.filename] = {
        content: file.content
      }
    })

    let activeSnippet = this.props.gists[this.props.activeGist]
    for (let preFile in activeSnippet.details.files) {
      logger.debug('!! The preFile is ' + preFile)
      if (!processedFiles[preFile]) {
        processedFiles[preFile] = null
      }
    }

    logger.debug('The processedFiles are ' + JSON.stringify(processedFiles))

    getGitHubApi(EDIT_SINGLE_GIST)(
      this.props.accessToken,
      this.props.activeGist,
      description,
      processedFiles)
    .catch((err) => {
      Notifier('Gist update failed', err)
      logger.error(JSON.stringify(err))
    })
    .then((response) => {
      this.updateGistsStoreWithUpdatedGist(response)
    })
    .finally(() => {
      logger.debug('Closing the editor modal')
      this.closeGistEditorModal()
    })
  }

  updateGistsStoreWithUpdatedGist (gistDetails) {
    let { gists, activeGist, langTags, activeLangTag, updateSingleGist,
      updateLangTags, selectLangTag, searchIndex} = this.props

    let gistId = gistDetails.id
    logger.debug('The new gist id is ' + gistId)
    let files = gistDetails.files

    let activeSnippet = this.props.gists[this.props.activeGist]
    let preLangs = activeSnippet.langs

    // Adding files in an eidt could introduce some changes to the langTags.
    // 1) if a gist has a new language, we should add the gist id to this
    // language tag, ie langTags[language] 2) if the new language doesn't
    // exist, we should add the new language to langTags.
    let newLangs = new Set()
    Object.keys(files).forEach(filename => {
      let file = files[filename]
      let language = file.language
      newLangs.add(language)
      if (langTags.hasOwnProperty(language)) {
        if (langTags[language].indexOf(gistId) === -1) {
          langTags[language].unshift(gistId)
        }
      } else {
        langTags[language] = []
        langTags[language].unshift(gistId)
      }
    })

    logger.debug('Filtering out the outdated gistId in the langTags')
    // Removing files in an eidt could introduce some changes to the langTags.
    // 1) if a gist no long has a language, we should remove the gist id from
    // this language tag 2) if the updated language tag is empty, we should remove
    // this tag at all.
    for (let language of preLangs) {
      if (!newLangs.has(language)) {
        langTags[language] = langTags[language].filter((value) => {
          return value !== gistId
        })
        if (langTags[language].length === 0) {
          delete langTags[language]
        }
      }
    }

    let updatedGist = {}
    updatedGist[gistId] = {
      langs: newLangs,
      brief: gistDetails,
      details: gistDetails
    }

    logger.info('** dispatch updateSingleGist')
    updateSingleGist(updatedGist)

    logger.info('** dispatch updateLangTags')
    updateLangTags(langTags)

    // If the previous active language tag is no longer valid, for example,
    // user deletes all cpp files inside a gist when C++ tag is the ative tag,
    // or the gist array for the preivous active language tag is empty, we
    // choose to fall back to 'All'.
    if (!langTags[activeLangTag] || !langTags[activeLangTag].includes(gistId)) {
      logger.info('** dispatch selectLangTag')
      logger.debug('The selected language tag is All')
      selectLangTag('All')
    }
    // logger.info('** dispatch selectGist')
    // this.props.selectGist(gistId)

    logger.debug('>>>>> ' + 'update the searchIndex with ' + gistDetails.description)
    searchIndex.updateToIndex({
      id: gistId,
      description: gistDetails.description
    })

    Notifier('Gist updated', HumanReadableTime(new Date()))
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
        className='raw-modal'
        show={ this.state.showRawModal }
        onHide={ this.closeRawModal.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>{ this.state.rawFile }</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <textarea className='code-area-raw' defaultValue={ this.state.rawContent } />
        </Modal.Body>
      </Modal>
    )
  }

  createMarkup (content, language) {
    language = language === 'Shell' ? 'Bash' : language
    let html = '<pre><code>' + HighlightJS.highlightAuto(content, [language]).value + '</code></pre>'
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
          onClick={ this.showGistEditorModal.bind(this, activeSnippet.details) }>
          #edit
        </a>
        <a className='customized-button'
          href='#'
          onClick={ shell.openExternal.bind(this, activeSnippet.brief.html_url + '/revisions') }>
          #revisions
        </a>
        <a className='customized-button'
          href='#'
          onClick={ this.showDeleteModal.bind(this) }>
          #delete
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
              dangerouslySetInnerHTML={ this.createMarkup(gistFile.content, gistFile.language) }/>
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <Panel className='snippet-code'
          bsStyle={ activeSnippet.brief.public ? 'default' : 'danger' }
          header={ this.renderPanelHeader(activeSnippet) }>
          <p className='snippet-decription'>{ activeSnippet.brief.description }</p>
          { this.renderGistEditorModal(activeSnippet.brief.description, fileArray, !activeSnippet.brief.public) }
          { this.renderRawModal() }
          { this.renderDeleteModal() }
          { fileHtmlArray }
        </Panel>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    gists: state.gists,
    activeLangTag: state.activeLangTag,
    activeGist: state.activeGist,
    userSession: state.userSession,
    accessToken: state.accessToken,
    langTags: state.langTags,
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateSingleGist: updateSingleGist,
    updateLangTags: updateLangTags,
    selectLangTag: selectLangTag
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Snippet)
