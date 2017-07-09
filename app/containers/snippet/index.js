'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { Panel, Modal, Button, ProgressBar, Collapse } from 'react-bootstrap'
import { default as GistEditorForm, UPDATE_GIST } from '../gistEditorForm'
import HighlightJS from 'highlight.js'
import Markdown from 'marked'
import { remote, clipboard, ipcRenderer } from 'electron'
import Notifier from '../../utilities/notifier'
import HumanReadableTime from 'human-readable-time'
import Autolinker from 'autolinker'
import Moment from 'moment'
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
  updateFileExpandStatus,
  updateGistTags } from '../../actions/index'

import {
  getGitHubApi,
  EDIT_SINGLE_GIST,
  DELETE_SINGLE_GIST
} from '../../utilities/githubApi'

import './index.scss'
import '../../utilities/vendor/highlightJS/styles/github-gist.css'
import collapsedIcon from './ic_collapsed.svg'
import expandedIcon from './ic_expanded.svg'

const logger = remote.getGlobal('logger')

// Synchronous highlighting with highlight.js
Markdown.setOptions({
  highlight: function (code) {
    return HighlightJS.highlightAuto(code).value
  }
})

class Snippet extends Component {
  componentWillMount () {
    ipcRenderer.on('edit-gist-renderer', () => {
      this.showGistEditorModal()
    })
  }

  componentWillUnmount () {
    ipcRenderer.removeAllListeners('edit-gist-renderer')
  }

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
      <div className='static-modal'>
        <Modal show={ this.props.gistDeleteModalStatus === 'ON' } bsSize='small' keyboard={ true }>
          <Modal.Header>
            <Modal.Title>Delete the gist?</Modal.Title>
          </Modal.Header>
          <Modal.Footer>
            <Button onClick={ this.closeDeleteModal.bind(this) }>cancel</Button>
            <Button
              bsStyle='danger'
              onClick={ this.handleDeleteClicked.bind(this) }>delete</Button>
          </Modal.Footer>
        </Modal>
      </div>
    )
  }

  showGistEditorModal () {
    const { gists, activeGist, updateGistEditModeStatus } = this.props
    if (gists && gists[activeGist] && gists[activeGist].details) {
      updateGistEditModeStatus('ON')
    }
  }

  closeGistEditorModal () {
    this.props.updateGistEditModeStatus('OFF')
  }

  handleGistEditorFormSubmit (data) {
    const { gists, activeGist, accessToken } = this.props
    const description = data.description.trim()
    const processedFiles = {}

    data.gistFiles.forEach((file) => {
      processedFiles[file.filename.trim()] = {
        content: file.content
      }
    })

    const activeSnippet = gists[activeGist]
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

    return getGitHubApi(EDIT_SINGLE_GIST)(
        accessToken,
        activeGist,
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
    const { gists, activeGist, gistTags, activeGistTag, updateSingleGist,
      updateGistTags, selectGistTag, searchIndex} = this.props

    const gistId = gistDetails.id
    const files = gistDetails.files

    const activeSnippet = gists[activeGist]
    const preLangs = activeSnippet.langs
    const preCustomTags = parseCustomTags(descriptionParser(activeSnippet.brief.description).customTags)

    // Adding files in an eidt could introduce some changes to the gistTags.
    // 1) if a gist has a new language, we should add the gist id to this
    // language tag, ie gistTags[language] 2) if the new language doesn't
    // exist, we should add the new language to gistTags.
    const newLangs = new Set()
    let filenameRecords = ''

    Object.keys(files).forEach(filename => {
      filenameRecords = ',' + filename
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
      details: gistDetails,
      filename: filenameRecords
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
        handleCancel = { this.closeGistEditorModal.bind(this) }
        onSubmit={ this.handleGistEditorFormSubmit.bind(this) }/>
    )
  }

  renderGistEditorModal (description, fileArray, isPrivate) {
    return (
      <Modal
        bsSize='large'
        dialogClassName='edit-modal'
        animation={ false }
        backdrop='static'
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
      content: null,
      link: null
    })
  }

  handleCopyGistFileClicked (gist) {
    clipboard.writeText(gist.content)
    Notifier('Copied', 'The content has been copied to the clipboard.')
  }

  showRawModalModal (gist) {
    this.props.updateGistRawModal({
      status: 'ON',
      file: gist.filename,
      content: gist.content,
      link: gist.raw_url
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
          <Modal.Title>
            { gistRawModal.file }
            <a className='copy-raw-link' href='#' onClick={ this.handleCopyRawLinkClicked.bind(this, gistRawModal.link) }>#link</a>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <textarea
              ref='rawModalText'
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

  //  Adapt the language name for Highlight.js. For example, 'C#' should be
  //  expressed as 'cs' to be recognized by Highlight.js.
  adaptedLanguage (lang) {
    let language = lang || 'Other'

    switch (language) {
      case 'Shell': return 'Bash'
      case 'C#': return 'cs'
      case 'Objective-C': return 'objectivec'
      case 'Objective-C++': return 'objectivec'
      default:
    }
    return language
  }

  createMarkdownCodeBlock (content) {
    return `<div class='markdown-section'>${Markdown(content)}</div>`
  }

  createHighlightedCodeBlock (content, language) {
    let lineNumber = 0
    const highlightedContent = HighlightJS.highlightAuto(content, [language]).value

    /*
      Highlight.js wraps comment blocks inside <span class='hljs-comment'></span>.
      However, when the multi-line comment block is broken down into diffirent
      table rows, only the first row, which is appended by the <span> tag, is
      highlighted. The following code fixes it by appending <span> to each line
      of the comment block.
    */
    const commentPattern = /<span class="hljs-comment">(.|\n)*?<\/span>/g
    const adaptedHighlightedContent = highlightedContent.replace(commentPattern, data => {
      return data.replace(/\r?\n/g, () => {
         // Chromium is smart enough to add the closing </span>
        return "\n<span class='hljs-comment'>"
      })
    })

    const contentTable = adaptedHighlightedContent.split(/\r?\n/).map(lineContent => {
      return `<tr>
                <td class='line-number' data-pseudo-content=${++lineNumber}></td>
                <td>${lineContent}</td>
              </tr>`
    }).join('')

    return `<pre><code><table class='code-table'>${contentTable}</table></code></pre>`
  }

  createMarkup (content, lang) {
    const language = this.adaptedLanguage(lang)
    const htmlContent = language === 'Markdown'
        ? this.createMarkdownCodeBlock(content)
        : this.createHighlightedCodeBlock(content, language)

    return { __html: htmlContent }
  }

  handleShareClicked (url) {
    clipboard.writeText(url)
    Notifier('Copied', 'The share link has been copied to the clipboard.')
  }

  handleCopyRawLinkClicked (url) {
    clipboard.writeText(url)
    Notifier('Copied', 'The raw file link has been copied to the clipboard.')
  }

  renderPanelHeader (activeSnippet) {
    return (
      <div className='header-table'>
        <div className='line'>
          <div className='header-title'>
            { activeSnippet.brief.public ? 'public gist' : 'secret gist' }
          </div>
          <div className='header-controls'>
            <a className='snippet-control'
              title='Edit'
              href='#'
              onClick={ this.showGistEditorModal.bind(this) }>
              <svg viewBox="0 0 50 50"><path d="M9.6 40.4l2.5-9.9L27 15.6l7.4 7.4-14.9 14.9-9.9 2.5zm4.3-8.9l-1.5 6.1 6.1-1.5L31.6 23 27 18.4 13.9 31.5z"/><path d="M17.8 37.3c-.6-2.5-2.6-4.5-5.1-5.1l.5-1.9c3.2.8 5.7 3.3 6.5 6.5l-1.9.5z"/><path d="M29.298 19.287l1.414 1.414-13.01 13.02-1.414-1.41z"/><path d="M11 39l2.9-.7c-.3-1.1-1.1-1.9-2.2-2.2L11 39z"/><path d="M35 22.4L27.6 15l3-3 .5.1c3.6.5 6.4 3.3 6.9 6.9l.1.5-3.1 2.9zM30.4 15l4.6 4.6.9-.9c-.5-2.3-2.3-4.1-4.6-4.6l-.9.9z"/></svg>
           </a>
            <a className='snippet-control'
              title='Share'
              href='#'
              onClick={ this.handleShareClicked.bind(this, activeSnippet.brief.html_url) }>
              <svg style={{marginTop: 1}} viewBox="0 0 50 50"><path d="M38.288 10.297l1.414 1.415-14.99 14.99-1.414-1.414z"/><path d="M40 20h-2v-8h-8v-2h10z"/><path d="M35 38H15c-1.7 0-3-1.3-3-3V15c0-1.7 1.3-3 3-3h11v2H15c-.6 0-1 .4-1 1v20c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V24h2v11c0 1.7-1.3 3-3 3z"/></svg>
          </a>
            <a className='snippet-control'
              title='Revisions'
              href={ activeSnippet.brief.html_url + '/revisions' }>
              <svg viewBox="0 0 50 50"><path d="M25 36C13.5 36 8.3 25.9 8.1 25.4c-.1-.3-.1-.6 0-.9C8.3 24.1 13.5 14 25 14s16.7 10.1 16.9 10.6c.1.3.1.6 0 .9-.2.4-5.4 10.5-16.9 10.5zM10.1 25c1.1 1.9 5.9 9 14.9 9s13.7-7.1 14.9-9c-1.1-1.9-5.9-9-14.9-9s-13.7 7.1-14.9 9z"/><path d="M25 34c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9zm0-16c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7z"/><path d="M25 30c-2.8 0-5-2.2-5-5 0-.6.4-1 1-1s1 .4 1 1c0 1.7 1.3 3 3 3s3-1.3 3-3-1.3-3-3-3c-.6 0-1-.4-1-1s.4-1 1-1c2.8 0 5 2.2 5 5s-2.2 5-5 5z"/></svg>
          </a>
            {
              this.props.immersiveMode === 'OFF'
                ? <a className='snippet-control'
                  title='Delete'
                  href='#'
                  onClick={ this.showDeleteModal.bind(this) }>
                  <svg viewBox="0 0 50 50"><path d="M20 18h2v16h-2z"/><path d="M24 18h2v16h-2z"/><path d="M28 18h2v16h-2z"/><path d="M12 12h26v2H12z"/><path d="M30 12h-2v-1c0-.6-.4-1-1-1h-4c-.6 0-1 .4-1 1v1h-2v-1c0-1.7 1.3-3 3-3h4c1.7 0 3 1.3 3 3v1z"/><path d="M31 40H19c-1.6 0-3-1.3-3.2-2.9l-1.8-24 2-.2 1.8 24c0 .6.6 1.1 1.2 1.1h12c.6 0 1.1-.5 1.2-1.1l1.8-24 2 .2-1.8 24C34 38.7 32.6 40 31 40z"/></svg>
                 </a>
                : null
            }
          </div>
        </div>
      </div>
    )
  }

  renderSnippetDescription (gist) {
    const { title, description, customTags } = descriptionParser(gist.brief.description)

    const htmlForDescriptionSection = []
    if (title.length > 0) {
      htmlForDescriptionSection.push(<div className='title-section' key='title'>{ title }</div>)
    }
    htmlForDescriptionSection.push(
        <div className='description-section' key='description'
            dangerouslySetInnerHTML={ {__html: Autolinker.link(description, { newWindow: false })} }/>
    )
    htmlForDescriptionSection.push(
        <div className='custom-tags-section' key='customTags'>
          { customTags.length > 0
              ? <span className='custom-tags'><span>{ customTags }</span></span>
              : null }
          <span className='update-date'>
              { 'Last active ' + Moment(gist.brief.updated_at).fromNow() }
          </span>
        </div>)

    return (
      <div>
        { htmlForDescriptionSection }
      </div>
    )
  }

  handleCollapseClicked (filename) {
    const { activeGist, fileExpandStatus, updateFileExpandStatus } = this.props

    const key = activeGist + '-' + filename
    if (fileExpandStatus[key] === undefined) {
      // If the file is clicked for the first time, it has no records in the
      // fileExpandStatus list. Therefore, its value would be undefined, but we still
      // treat it as true because the file is expanded by default.
      fileExpandStatus[key] = false
    } else {
      fileExpandStatus[key] = !fileExpandStatus[key]
    }
    updateFileExpandStatus(fileExpandStatus)
  }

  render () {
    const { gists, activeGist, fileExpandStatus } = this.props
    const activeSnippet = gists[activeGist]
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

        const expandStatusKey = activeGist + '-' + key
        // undefined should be treated as true as explained above
        let isExpanded = true
        if (fileExpandStatus[expandStatusKey] === false) {
          isExpanded = false
        }

        fileHtmlArray.push(
          <div key={ key }>
            <hr/>
            <div className={ gistFile.language === 'Markdown' ? 'file-header-md' : 'file-header' }>
              <a href='#'
                className={isExpanded ? 'file-expand is-expanded' : 'file-expand'}
                onClick={ this.handleCollapseClicked.bind(this, key) }>
                <span>{ gistFile.filename }</span>
              </a>
              <div className='file-header-controls'>
                <a
                  href={ activeSnippet.details.html_url + '#file-' + gistFile.filename.replace(/\./g, '-') }
                  className='file-header-control'
                  onClick={ this.showRawModalModal.bind(this, gistFile) }>
                  #link
                </a>
                <a
                  href='#'
                  className='file-header-control'
                  onClick={ this.showRawModalModal.bind(this, gistFile) }>
                  #raw
                </a>
                <a
                  href='#'
                  className='file-header-control'
                  onClick={ this.handleCopyGistFileClicked.bind(this, gistFile) }>
                  #copy
                </a>
              </div>
            </div>
            <Collapse in={ isExpanded }>
              <div
                className='code-area'
                dangerouslySetInnerHTML={ this.createMarkup(gistFile.content, gistFile.language) }/>
            </Collapse>
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <Panel className='snippet-code'
          bsStyle={ activeSnippet.brief.public ? 'default' : 'danger' }
          header={ this.renderPanelHeader(activeSnippet) }>
          <div className='snippet-description'>{ this.renderSnippetDescription(activeSnippet) }</div>
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
    gistDeleteModalStatus: state.gistDeleteModalStatus,
    fileExpandStatus: state.fileExpandStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateSingleGist: updateSingleGist,
    updateGistTags: updateGistTags,
    selectGistTag: selectGistTag,
    updateGistEditModeStatus: updateGistEditModeStatus,
    updateGistDeleteModeStatus: updateGistDeleteModeStatus,
    updateGistRawModal: updateGistRawModal,
    updateFileExpandStatus: updateFileExpandStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Snippet)
