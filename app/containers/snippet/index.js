import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { default as GistEditorForm, UPDATE_GIST } from '../gistEditorForm'
import { Button, ProgressBar } from 'react-bootstrap'
import electronBridge from '../../utilities/electronBridge'
import Autolinker from 'autolinker'
import CodeArea from '../codeArea'
import ImageFileView from '../imageFileView'
import Panel, { Collapse } from '../compatPanel'
import HumanReadableTime from 'human-readable-time'
import Modal from '../compatModal'
import { notifySuccess, notifyFailure } from '../../utilities/notifier'
import React, { Component } from 'react'
import { subscribeIpc, unsubscribeIpc } from '../../utilities/ipcSubscriptions'
import { t } from '../../utilities/i18n'
import { formatRelativeTime } from '../../utilities/relativeTime'
import { buildGistFilesPatch } from '../../utilities/gistFilesPatch'
import TagBadges from '../tagBadges'
import { toggleMarkdownTaskListItem } from '../../utilities/markdown/taskList'
import { createDefaultGistFilters, getFilteredGistIds } from '../../utilities/gistFilters'
import {
  getRegularTagsForGist,
  shouldColorTags
} from '../tagBadges/tags'
import {
  addLangPrefix as Prefixed,
  descriptionParser,
  parseCustomTags,
} from '../../utilities/parser'
import {
  updateFileExpandStatus,
  updateGistFilters,
  updateGistDeleteModeStatus,
  updateGistEditModeStatus,
  updateGistRawModal,
  updateGistTags,
  updateSingleGist,
} from '../../actions'
import {
  DELETE_SINGLE_GIST,
  EDIT_SINGLE_GIST,
  getSnippetApi,
} from '../../utilities/snippetApi'
import {
  getSessionGeneration,
  isSessionGenerationCurrent
} from '../../utilities/sessionGeneration'
import { cloneSnippetTagMap } from '../../utilities/snippetTags'

import './index.scss'

import editIcon from './ei-edit.svg'
import eyeIcon from './ei-eye.svg'
import openInWebIcon from './ei-share.svg'
import secretIcon from './lock.svg'
import tagsIcon from './tags.svg'
import trashIcon from './ei-trash.svg'

const {
  getRenderableImageSource,
  isImageAttachmentFile,
  isNativeBinaryImage
} = require('../../utilities/imageAttachments')

const clipboard = electronBridge.clipboard
const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

const kIsExpanded = conf.get('snippet:expanded')
const kTabLength = conf.get('editor:tabSize')

class Snippet extends Component {
  constructor (props) {
    super(props)
    this.fileNodes = Object.create(null)
  }

  componentDidMount () {
    this.ipcSubscriptions = []
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'edit-gist-renderer', () => {
      this.showGistEditorModal()
    })
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'exit-editor', () => {
      this.closeGistEditorModal()
    })
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'delete-gist', () => {
      this.showDeleteModal()
    })
  }

  componentWillUnmount () {
    unsubscribeIpc(this.ipcSubscriptions)
  }

  showDeleteModal () {
    this.props.updateGistDeleteModeStatus('ON')
  }

  closeDeleteModal () {
    this.props.updateGistDeleteModeStatus('OFF')
  }

  handleDeleteClicked () {
    const { accessToken, activeGist } = this.props
    const sessionGeneration = getSessionGeneration()
    return getSnippetApi(DELETE_SINGLE_GIST)(
      accessToken,
      activeGist)
      .then(data => {
        if (!isSessionGenerationCurrent(sessionGeneration)) return
        logger.info('The snippet ' + activeGist + ' has been deleted.')
        notifySuccess(t('notification.gistDeleted'))

        // For performance purpose, we should perform an internal update, like what
        // we're doing for creating/edit gists. However, since delete is an infrequent
        // operation, we decide to just call the resync method and keep the logic
        // simple.
        this.props.reSyncUserGists()
      })
      .catch(err => {
        if (!isSessionGenerationCurrent(sessionGeneration)) return
        logger.error('Failed to delete the snippet ' + activeGist)
        logger.error(JSON.stringify(err))
        notifyFailure(t('notification.deletionFailed'), t('notification.networkFailure', { code: '02' }))
      })
      .finally(() => {
        if (isSessionGenerationCurrent(sessionGeneration)) this.closeDeleteModal()
      })
  }

  renderDeleteModal () {
    return (
      <div className='static-modal'>
        <Modal show={ this.props.gistDeleteModalStatus === 'ON' } bsSize='small' keyboard={ true }>
          <Modal.Header>
            <Modal.Title>{ t('snippet.deleteConfirmTitle') }</Modal.Title>
          </Modal.Header>
          <Modal.Footer>
            <Button onClick={ this.closeDeleteModal.bind(this) }>{ t('editor.cancel') }</Button>
            <Button
              bsStyle='danger'
              onClick={ this.handleDeleteClicked.bind(this) }>{ t('snippet.deleteAction') }</Button>
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
    const sessionGeneration = getSessionGeneration()
    const description = data.description.trim()
    const activeSnippet = gists[activeGist]
    const processedFiles = buildGistFilesPatch(data.gistFiles, activeSnippet.details.files)

    // In the past, we close the dialog after getting response from the server
    // both for the “create” and “edit” actions. However, the state change for
    // the “edit” action is less intensive than “create”, for example, the active
    // language tag and the active gist are likely be the same as before.
    // Therefore, we decide the close the dialog without waiting for the server’s
    // response, which provides better user experience.
    this.closeGistEditorModal()

    return getSnippetApi(EDIT_SINGLE_GIST)(
      accessToken,
      activeGist,
      description,
      processedFiles)
      .then((response) => {
        if (!isSessionGenerationCurrent(sessionGeneration)) return
        this.updateGistsStoreWithUpdatedGist(response)
      })
      .catch((err) => {
        if (!isSessionGenerationCurrent(sessionGeneration)) return
        notifyFailure(t('notification.gistUpdateFailed'))
        logger.error(JSON.stringify(err))
      })
  }

  handleMarkdownTaskListItemToggle (activeSnippet, gistFile, taskIndex, checked) {
    const { accessToken, activeGist } = this.props
    const sessionGeneration = getSessionGeneration()
    const updatedContent = toggleMarkdownTaskListItem(gistFile.content, taskIndex, checked)

    if (updatedContent === gistFile.content) {
      return Promise.resolve()
    }

    return getSnippetApi(EDIT_SINGLE_GIST)(
      accessToken,
      activeGist,
      activeSnippet.details.description,
      {
        [gistFile.filename]: {
          content: updatedContent
        }
      })
      .catch((err) => {
        if (!isSessionGenerationCurrent(sessionGeneration)) return
        notifyFailure(t('notification.gistUpdateFailed'))
        logger.error(JSON.stringify(err))
        throw err
      })
      .then((response) => {
        if (!response || !isSessionGenerationCurrent(sessionGeneration)) return
        this.updateGistsStoreWithUpdatedGist(response)
      })
  }

  updateGistsStoreWithUpdatedGist (gistDetails) {
    const {
      gists, activeGist, activeGistFilters, gistTags: currentGistTags,
      updateSingleGist, updateGistFilters, updateGistTags, searchIndex
    } = this.props

    const activeSnippet = gists[activeGist]
    gistDetails = mergeCachedFileDetails(gistDetails, activeSnippet.details)
    const gistId = gistDetails.id
    const files = gistDetails.files
    const gistTags = cloneSnippetTagMap(currentGistTags)

    const preLangs = activeSnippet.langs
    const preCustomTags = parseCustomTags(descriptionParser(activeSnippet.brief).customTags)

    // Adding files in an eidt could introduce some changes to the gistTags.
    // 1) if a gist has a new language, we should add the gist id to this
    // language tag, ie gistTags[language] 2) if the new language doesn't
    // exist, we should add the new language to gistTags.
    const newLangs = new Set()
    let filenameRecords = ''

    Object.keys(files).forEach(filename => {
      // leave a space in between to help tokenization
      filenameRecords += ', ' + filename
      const file = files[filename]
      if (isImageAttachmentFile(Object.assign({ filename }, file))) return
      const language = file.language || 'Other'
      newLangs.add(language)
      const prefixedLang = Prefixed(language)
      if (Object.prototype.hasOwnProperty.call(gistTags, prefixedLang)) {
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
        if (!Object.prototype.hasOwnProperty.call(gistTags, prefixedLang)) return
        gistTags[prefixedLang] = gistTags[prefixedLang].filter(value => {
          return value !== gistId
        })
        if (gistTags[prefixedLang].length === 0) {
          delete gistTags[prefixedLang]
        }
      }
    })

    // We update the custom tags with the similar reasons mentioned above
    const newCustomTags = parseCustomTags(descriptionParser(gistDetails).customTags)
    newCustomTags.forEach(tag => {
      if (Object.prototype.hasOwnProperty.call(gistTags, tag)) {
        if (!gistTags[tag].includes(gistId)) {
          gistTags[tag].unshift(gistId)
        }
      } else {
        gistTags[tag] = []
        gistTags[tag].unshift(gistId)
      }
    })

    preCustomTags.forEach(tag => {
      if (!Object.prototype.hasOwnProperty.call(gistTags, tag)) return
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

    // Keep the edited snippet visible if it no longer satisfies the active
    // language and tag filters.
    if (!getFilteredGistIds(gistTags, activeGistFilters).includes(gistId)) {
      logger.info('[Dispatch] updateGistFilters')
      updateGistFilters(createDefaultGistFilters())
    }
    // logger.info('[Dispatch] selectGist')
    // this.props.selectGist(gistId)

    // Update the search index
    searchIndex.updateFuseIndex(searchIndex.buildSearchRecord(updatedGist[gistId]))

    notifySuccess(t('notification.gistUpdated'), HumanReadableTime(new Date()))
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
        keyboard={ false }
        show={ this.props.gistEditModalStatus === 'ON' }
        onHide={ this.closeGistEditorModal.bind(this)}>
        <Modal.Header closeButton>
          <Modal.Title>{ t('snippet.edit') }</Modal.Title>
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

  handleCopyGistLinkClicked (snippet, file) {
    const link = file.html_url || (snippet.details.providerType === 'gitlab'
      ? snippet.details.html_url
      : snippet.details.html_url + '#file-' + file.filename.replace(/\./g, '-').toLowerCase())
    clipboard.writeText(link)
    notifySuccess(t('notification.copied'), t('notification.linkCopied'))
  }

  handleCopyGistFileClicked (gist) {
    clipboard.writeText(gist.content)
    notifySuccess(t('notification.copied'), t('notification.contentCopied'))
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
            <a className='copy-raw-link' href='#' onClick={ this.handleCopyRawLinkClicked.bind(this, gistRawModal.link) }>{ t('snippet.link') }</a>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <textarea
            ref={ this.setRawModalTextNode.bind(this) }
            className='code-area-raw'
            defaultValue={ gistRawModal.content }
            onDoubleClick={ this.selectText.bind(this) } />
        </Modal.Body>
      </Modal>
    )
  }

  setRawModalTextNode (node) {
    this.rawModalText = node
  }

  selectText () {
    if (this.rawModalText) {
      this.rawModalText.select()
    }
  }

  handleCopyRawLinkClicked (url) {
    clipboard.writeText(url)
    notifySuccess(t('notification.copied'), t('notification.rawLinkCopied'))
  }

  renderPanelHeader (activeSnippet) {
    const isInternal = activeSnippet.brief.providerType === 'gitlab' &&
      activeSnippet.brief.visibility === 'internal'
    const historyUrl = activeSnippet.brief.history_url !== undefined
      ? activeSnippet.brief.history_url
      : activeSnippet.brief.providerType === 'gitlab'
        ? null
        : activeSnippet.brief.html_url + '/revisions'

    return (
      <div className='header-table'>
        <div className='line'>
          <div className='header-title'>
            { activeSnippet.brief.public
              ? t('snippet.publicGist')
              : [
                <div key='icon'className='secret-icon' dangerouslySetInnerHTML={{ __html: secretIcon }} />,
                <span key='description' >
                  { isInternal ? t('snippet.internalGist') : t('snippet.secretGist') }
                </span>
              ]
            }
          </div>
          <div className='header-controls'>
            <a className='snippet-control'
              title={ t('snippet.edit') }
              href='#'
              onClick={ this.showGistEditorModal.bind(this) }>
              <div dangerouslySetInnerHTML={{ __html: editIcon }} />
            </a>
            <a className='snippet-control'
              title={ t('snippet.openInWeb') }
              href={ activeSnippet.brief.html_url }>
              <div dangerouslySetInnerHTML={{ __html: openInWebIcon }} />
            </a>
            { historyUrl
              ? <a className='snippet-control'
                title={ t('snippet.revisions') }
                href={ historyUrl }>
                <div dangerouslySetInnerHTML={{ __html: eyeIcon }} />
              </a>
              : null }
            {
              this.props.immersiveMode === 'OFF'
                ? <a className='snippet-control'
                  title={ t('snippet.delete') }
                  href='#'
                  onClick={ this.showDeleteModal.bind(this) }>
                  <div dangerouslySetInnerHTML={{ __html: trashIcon }} />
                </a>
                : null
            }
          </div>
        </div>
      </div>
    )
  }

  renderSnippetDescription (gist) {
    const { title, description, customTags } = descriptionParser(gist.brief)
    const tags = getRegularTagsForGist(gist.brief.id, customTags, this.props.gistTags)
    const useColoredTags = shouldColorTags(conf)

    const htmlForDescriptionSection = []
    if (title.length > 0) {
      htmlForDescriptionSection.push(<div className='title-section' key='title'>{ title }</div>)
    }
    htmlForDescriptionSection.push(
      <div className='description-section' key='description'
        dangerouslySetInnerHTML={ {
          __html: Autolinker.link(description, {
            stripPrefix: {
              scheme: true,
              www: true
            },
            newWindow: false
          })
        } }/>
    )
    htmlForDescriptionSection.push(
      <div className='custom-tags-section' key='customTags'>
        { tags.length > 0
          ? <div className='custom-tags'>
            <div
              className='custom-tags-icon'
              dangerouslySetInnerHTML={{ __html: tagsIcon }} />
            { useColoredTags
              ? <TagBadges
                tags={ tags }
                className='snippet-detail-tags'
                colored={ useColoredTags } />
              : <span className='custom-tags-text'>{ tags.join(', ') }</span> }
          </div>
          : null }
        <span className='update-date'>
          { t('snippet.lastActive', { time: formatRelativeTime(gist.brief.updated_at) }) }
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
    const nextFileExpandStatus = Object.assign({}, fileExpandStatus)
    if (nextFileExpandStatus[key] === undefined) {
      // If the file is clicked for the first time, it has no records in the
      // fileExpandStatus list. Therefore, its value is undefined. We consider
      // it in the default status(either expanded or collapsed, depending on
      // settings in .leptonrc).
      nextFileExpandStatus[key] = !kIsExpanded
    } else {
      nextFileExpandStatus[key] = !nextFileExpandStatus[key]
    }
    updateFileExpandStatus(nextFileExpandStatus)
  }

  setFileNode (filename, node) {
    if (node) {
      this.fileNodes[filename] = node
    } else {
      delete this.fileNodes[filename]
    }
  }

  handleSiblingImageOpen (filename) {
    const {
      activeGist,
      fileExpandStatus,
      gists,
      updateFileExpandStatus
    } = this.props
    const activeSnippet = gists[activeGist]
    const files = activeSnippet && activeSnippet.details && activeSnippet.details.files
    if (!files || !Object.prototype.hasOwnProperty.call(files, filename)) return

    const key = activeGist + '-' + filename
    updateFileExpandStatus(Object.assign({}, fileExpandStatus, { [key]: true }))

    const node = this.fileNodes[filename]
    if (!node) return
    const focusFile = () => {
      if (typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ block: 'center' })
      }
      const header = node.querySelector('.file-expand')
      if (header) header.focus()
    }
    const view = node.ownerDocument && node.ownerDocument.defaultView
    if (view && typeof view.requestAnimationFrame === 'function') {
      view.requestAnimationFrame(focusFile)
    } else {
      setTimeout(focusFile, 0)
    }
  }

  render () {
    const { gists, activeGist, fileExpandStatus } = this.props
    const activeSnippet = gists[activeGist]
    if (!activeSnippet) return null
    const isInternal = activeSnippet.brief.providerType === 'gitlab' &&
      activeSnippet.brief.visibility === 'internal'

    const fileHtmlArray = []
    const fileArray = []
    if (activeSnippet.details) {
      const fileList = activeSnippet.details.files
      for (const key in fileList) {
        const gistFile = fileList[key]
        const normalizedGistFile = Object.assign({ filename: key }, gistFile)

        fileArray.push(normalizedGistFile)

        const expandStatusKey = activeGist + '-' + key
        // undefined should be treated as the default value as explained above
        let isExpanded = kIsExpanded
        if (fileExpandStatus[expandStatusKey] === false) {
          isExpanded = false
        } else if (fileExpandStatus[expandStatusKey] === true) {
          isExpanded = true
        }

        fileHtmlArray.push(
          <div
            key={ key }
            data-gist-filename={ key }
            ref={ node => this.setFileNode(key, node) }>
            <hr/>
            <div className={ gistFile.language === 'Markdown' ? 'file-header-md' : 'file-header' }>
              <a href='#'
                className={isExpanded ? 'file-expand is-expanded' : 'file-expand'}
                onClick={ this.handleCollapseClicked.bind(this, key) }>
                <span>{ gistFile.filename }</span>
              </a>
              <div className='file-header-controls'>
                <a
                  href='#'
                  className='file-header-control'
                  onClick={ this.handleCopyGistLinkClicked.bind(this, activeSnippet, gistFile) }>
                  { t('snippet.share') }
                </a>
                <a
                  href='#'
                  className='file-header-control'
                  onClick={ this.showRawModalModal.bind(this, gistFile) }>
                  { t('snippet.raw') }
                </a>
                <a
                  href='#'
                  className='file-header-control'
                  onClick={ this.handleCopyGistFileClicked.bind(this, gistFile) }>
                  { t('snippet.copy') }
                </a>
              </div>
            </div>
            <Collapse in={ isExpanded } unmountOnExit>
              <div className='collapsable-code-area'>
                { getRenderableImageSource(normalizedGistFile) || isNativeBinaryImage(normalizedGistFile)
                  ? <ImageFileView
                    filename={ normalizedGistFile.filename }
                    content={ normalizedGistFile.content }
                    encoding={ normalizedGistFile.encoding }
                    rawUrl={ normalizedGistFile.raw_url }
                    size={ normalizedGistFile.size }
                    truncated={ normalizedGistFile.truncated } />
                  : <CodeArea
                    filename={normalizedGistFile.filename}
                    content={gistFile.content}
                    language={gistFile.language}
                    kTabLength={kTabLength}
                    siblingFiles={ fileList }
                    onSiblingImageOpen={ this.handleSiblingImageOpen.bind(this) }
                    onMarkdownTaskListItemToggle={ this.handleMarkdownTaskListItemToggle.bind(this, activeSnippet, gistFile) }/> }
              </div>
            </Collapse>
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <Panel className='snippet-code'
          bsStyle={ isInternal ? 'warning' : activeSnippet.brief.public ? 'default' : 'danger' }>
          <Panel.Heading>{ this.renderPanelHeader(activeSnippet) }</Panel.Heading>
          <Panel.Body>
            <div className='snippet-description'>{ this.renderSnippetDescription(activeSnippet) }</div>
            { activeSnippet.details
              ? null
              : <ProgressBar className='snippet-progressbar' active now={ 100 }/> }
            { this.renderGistEditorModal(activeSnippet.brief.description, fileArray, !activeSnippet.brief.public) }
            { this.renderRawModal() }
            { this.renderDeleteModal() }
            { fileHtmlArray }
          </Panel.Body>
        </Panel>
      </div>
    )
  }
}

function mergeCachedFileDetails (gistDetails, cachedDetails) {
  const files = gistDetails && gistDetails.files
  const cachedFiles = cachedDetails && cachedDetails.files
  if (!files || !cachedFiles) return gistDetails

  let didMerge = false
  const mergedFiles = Object.create(null)

  Object.keys(files).forEach(filename => {
    const file = files[filename]
    const cachedFile = cachedFiles[filename]
    const hasContent = file && typeof file.content === 'string'
    const hasCachedContent = cachedFile && typeof cachedFile.content === 'string'

    if (!hasContent && hasCachedContent) {
      mergedFiles[filename] = Object.assign({}, cachedFile, file)
      didMerge = true
      return
    }

    mergedFiles[filename] = file
  })

  return didMerge
    ? Object.assign({}, gistDetails, { files: mergedFiles })
    : gistDetails
}

function mapStateToProps (state) {
  return {
    gists: state.gists,
    activeGistFilters: state.activeGistFilters,
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
    updateGistFilters: updateGistFilters,
    updateGistEditModeStatus: updateGistEditModeStatus,
    updateGistDeleteModeStatus: updateGistDeleteModeStatus,
    updateGistRawModal: updateGistRawModal,
    updateFileExpandStatus: updateFileExpandStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Snippet)
