'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { Panel, Modal, Button, ProgressBar } from 'react-bootstrap'
import GistEditorForm from '../gistEditorForm'
import { UPDATE_GIST } from '../gistEditorForm'
import HighlightJS from 'highlight.js'
import Markdown from 'marked'
import { shell, remote, clipboard } from 'electron'
import Notifier from '../../utilities/notifier'
import HumanReadableTime from 'human-readable-time'
import {
  addLangPrefix as Prefixed,
  parseCustomTags,
  descriptionParser } from '../../utilities/parser'

import {
  updateSingleGist,
  updateGistRawModal,
  updateGistEditModeStatus,
  updateGistDeleteModeStatus,
  selectGistTag,
  updateGistTags } from '../../actions/index'

import {
  getGitHubApi,
  EDIT_SINGLE_GIST,
  DELETE_SINGLE_GIST
} from '../../utilities/githubApi'

import './index.scss'
import '../../utilities/vendor/highlightJS/styles/github-gist.css'

const logger = remote.getGlobal('logger')

// Synchronous highlighting with highlight.js
Markdown.setOptions({
  highlight: function (code) {
    return HighlightJS.highlightAuto(code).value
  }
})

class Snippet extends Component {

  showDeleteModal () {
    this.props.updateGistDeleteModeStatus('ON')
  }

  closeDeleteModal () {
    this.props.updateGistDeleteModeStatus('OFF')
  }

  handleDeleteClicked () {
    const { accessToken, activeGist } = this.props
    getGitHubApi(DELETE_SINGLE_GIST)(
      accessToken,
      activeGist)
    .catch(err => {
      logger.error('Failed to delete the gist ' + activeGist)
      logger.error(JSON.stringify(err))
      Notifier('Deletion failed', 'Please check your network condition.')
    })
    .then(data => {
      logger.info('The gist ' + activeGist + ' has been deleted.')
      Notifier('The gist has been deleted')

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
        <Modal show={ this.props.gistDeleteModalStatus === 'ON' } bsSize="small">
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
    details && this.props.updateGistEditModeStatus('ON')
  }

  closeGistEditorModal () {
    this.props.updateGistEditModeStatus('OFF')
  }

  handleGistEditorFormSubmit (data) {
    const description = data.description
    const processedFiles = {}

    data.gistFiles.forEach((file) => {
      processedFiles[file.filename] = {
        content: file.content
      }
    })

    const activeSnippet = this.props.gists[this.props.activeGist]
    for (const preFile in activeSnippet.details.files) {
      if (!processedFiles[preFile]) {
        processedFiles[preFile] = null
      }
    }

    // In the past, we close the dialog after getting response from the server
    // both for the “create” and “edit” actions. However, the state change for
    // the “edit” action is less intensive than “create”, for example, the active
    // language tag and the active gist are likely be the same as before.
    // Therefore, we decide the close the dialog without waiting for the server’s
    // response, which provides better user experience.
    this.closeGistEditorModal()

    getGitHubApi(EDIT_SINGLE_GIST)(
      this.props.accessToken,
      this.props.activeGist,
      description,
      processedFiles)
    .catch((err) => {
      Notifier('Gist update failed')
      logger.error(JSON.stringify(err))
    })
    .then((response) => {
      this.updateGistsStoreWithUpdatedGist(response)
    })
  }

  updateGistsStoreWithUpdatedGist (gistDetails) {
    const { gistTags, activeGistTag, updateSingleGist,
      updateGistTags, selectGistTag, searchIndex} = this.props

    const gistId = gistDetails.id
    const files = gistDetails.files

    const activeSnippet = this.props.gists[this.props.activeGist]
    const preLangs = activeSnippet.langs
    const preCustomTags = parseCustomTags(descriptionParser(activeSnippet.brief.description).customTags)

    // Adding files in an eidt could introduce some changes to the gistTags.
    // 1) if a gist has a new language, we should add the gist id to this
    // language tag, ie gistTags[language] 2) if the new language doesn't
    // exist, we should add the new language to gistTags.
    const newLangs = new Set()
    Object.keys(files).forEach(filename => {
      const file = files[filename]
      const language = file.language || 'Other'
      newLangs.add(language)
      const prefixedLang = Prefixed(language)
      if (gistTags.hasOwnProperty(prefixedLang)) {
        if (!gistTags[prefixedLang].includes(gistId)) {
          gistTags[prefixedLang].unshift(gistId)
        }
      } else {
        gistTags[prefixedLang] = []
        gistTags[prefixedLang].unshift(gistId)
      }
    })

    // Removing files in an eidt could introduce some changes to the gistTags.
    // 1) if a gist no long has a language, we should remove the gist id from
    // this language tag 2) if the updated language tag is empty, we should remove
    // this tag at all.
    preLangs.forEach(language => {
      if (!newLangs.has(language)) {
        const prefixedLang = Prefixed(language)
        gistTags[prefixedLang] = gistTags[prefixedLang].filter(value => {
          return value !== gistId
        })
        if (gistTags[prefixedLang].length === 0) {
          delete gistTags[prefixedLang]
        }
      }
    })

    // We update the custom tags with the similar reasons mentioned above
    const newCustomTags = parseCustomTags(descriptionParser(gistDetails.description).customTags)
    newCustomTags.forEach(tag => {
      if (gistTags.hasOwnProperty(tag)) {
        if (!gistTags[tag].includes(gistId)) {
          gistTags[tag].unshift(gistId)
        }
      } else {
        gistTags[tag] = []
        gistTags[tag].unshift(gistId)
      }
    })

    preCustomTags.forEach(tag => {
      if (!newCustomTags.includes(tag)) {
        gistTags[tag] = gistTags[tag].filter(value => {
          return value !== gistId
        })
      }
      if (gistTags[tag].length === 0) {
        delete gistTags[tag]
      }
    })

    const updatedGist = {}
    updatedGist[gistId] = {
      langs: newLangs,
      brief: gistDetails,
      details: gistDetails
    }

    logger.info('[Dispatch] updateSingleGist')
    updateSingleGist(updatedGist)

    logger.info('[Dispatch] updateGistTags')
    updateGistTags(gistTags)

    // If the previous active language tag is no longer valid, for example,
    // user deletes all cpp files inside a gist when C++ tag is the ative tag,
    // or the gist array for the preivous active language tag is empty, we
    // choose to fall back to 'All'.
    if (!gistTags[activeGistTag] || !gistTags[activeGistTag].includes(gistId)) {
      logger.info('[Dispatch] selectGistTag')
      selectGistTag(Prefixed('All'))
    }
    // logger.info('[Dispatch] selectGist')
    // this.props.selectGist(gistId)

    // Update the search index
    let langSearchRecords = ''
    newLangs.forEach(lang => {
      langSearchRecords += ',' + lang
    })

    searchIndex.updateFuseIndex({
      id: gistId,
      description: gistDetails.description,
      language: langSearchRecords
    })

    Notifier('Gist updated', HumanReadableTime(new Date()))
  }

  renderGistEditorModalBody (description, fileArray, isPrivate) {
    const initialData = Object.assign({
      description: description,
      gists: fileArray,
      private: isPrivate
    })

    return (
      <GistEditorForm
        initialData={ initialData }
        formStyle = { UPDATE_GIST }
        onSubmit={ this.handleGistEditorFormSubmit.bind(this) }/>
    )
  }

  renderGistEditorModal (description, fileArray, isPrivate) {
    return (
      <Modal
        bsSize="large"
        dialogClassName="edit-modal"
        show={ this.props.gistEditModalStatus === 'ON' }
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
    this.props.updateGistRawModal({
      status: 'OFF',
      file: null,
      content: null
    })
  }

  showRawModalModal (gist) {
    this.props.updateGistRawModal({
      status: 'ON',
      file: gist.filename,
      content: gist.content
    })
  }

  renderRawModal () {
    const { gistRawModal } = this.props
    return (
      <Modal
        className='raw-modal'
        show={ gistRawModal.status === 'ON' }
        onHide={ this.closeRawModal.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>{ gistRawModal.file }</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <textarea
              ref="rawModalText"
              className='code-area-raw'
              defaultValue={ gistRawModal.content }
              onDoubleClick={ this.selectText.bind(this) } />
        </Modal.Body>
      </Modal>
    )
  }

  selectText () {
    this.refs.rawModalText.select()
  }

  createMarkup (content, lang) {
    let language = lang || 'Other'

    language = language === 'Shell' ? 'Bash' : language
    language = language.startsWith('Objective-C') ? 'objectivec' : language
    language = language === 'C#' ? 'cs' : language

    let htmlContent = ''

    if (language === 'Markdown') {
      htmlContent = `<div class='markdown-section'>${Markdown(content)}</div>`
    } else {
      let line = 0
      let html = `<span class='line-number' data-pseudo-content=${++line}></span>` +
          HighlightJS.highlightAuto(content, [language, 'css']).value
      let htmlWithLineNumbers = html.replace(/\r?\n/g, () => {
        return `\n<span class='line-number' data-pseudo-content=${++line}></span>`
      })
      htmlContent = `<pre><code>${htmlWithLineNumbers}</code></pre>`
    }
    return { __html: htmlContent }
  }

  handleShareClicked (url) {
    clipboard.writeText(url)
    Notifier('Copied', 'The share link has been copied to the clipboard.')
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
          onClick={ this.handleShareClicked.bind(this, activeSnippet.brief.html_url) }>
          #share
        </a>
        <a className='customized-button'
          href='#'
          onClick={ shell.openExternal.bind(this, activeSnippet.brief.html_url + '/revisions') }>
          #revisions
        </a>
        {
          this.props.immersiveMode === 'OFF'
            ? <a className='customized-button'
               href='#'
               onClick={ this.showDeleteModal.bind(this) }>
               #delete
              </a>
            : null
        }
      </div>
      </div>
    )
  }

  renderSnippetDescription (rawDescription) {
    const { title, description, customTags } = descriptionParser(rawDescription)

    const htmlForDescriptionSection = []
    if (title.length > 0) {
      htmlForDescriptionSection.push(<div className='title-section' key='title'>{ title }</div>)
    }
    htmlForDescriptionSection.push(<div className='description-section' key='description'>{ description }</div>)
    if (customTags.length > 0) {
      htmlForDescriptionSection.push(<div className='custom-tags-section' key='customTags'>{ customTags }</div>)
    }

    return (
      <div>
        { htmlForDescriptionSection }
      </div>
    )
  }

  render () {
    const activeSnippet = this.props.gists[this.props.activeGist]
    if (!activeSnippet) return null

    const fileHtmlArray = []
    const fileArray = []
    if (activeSnippet.details) {
      const fileList = activeSnippet.details.files
      for (const key in fileList) {
        const gistFile = fileList[key]
        fileArray.push(Object.assign({
          filename: gistFile.filename,
          content: gistFile.content
        }))
        fileHtmlArray.push(
          <div key={ key }>
            <hr/>
            <div className={ gistFile.language === 'Markdown' ? 'file-header-md' : 'file-header' }>
              <b>{ gistFile.filename }</b>
              <a
                href='#'
                className='customized-button-file-header'
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
          <div className='snippet-description'>{ this.renderSnippetDescription(activeSnippet.brief.description) }</div>
          { activeSnippet.details
              ? null
              : <ProgressBar className='snippet-progressbar' active now={ 100 }/> }
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
    activeGistTag: state.activeGistTag,
    activeGist: state.activeGist,
    userSession: state.userSession,
    accessToken: state.accessToken,
    gistTags: state.gistTags,
    immersiveMode: state.immersiveMode,
    gistRawModal: state.gistRawModal,
    gistEditModalStatus: state.gistEditModalStatus,
    gistDeleteModalStatus: state.gistDeleteModalStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateSingleGist: updateSingleGist,
    updateGistTags: updateGistTags,
    selectGistTag: selectGistTag,
    updateGistEditModeStatus: updateGistEditModeStatus,
    updateGistDeleteModeStatus: updateGistDeleteModeStatus,
    updateGistRawModal: updateGistRawModal
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Snippet)
