import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { default as GistEditorForm, UPDATE_GIST } from '../gistEditorForm'
import { Button, ProgressBar } from 'react-bootstrap'
import electronBridge from '../../utilities/electronBridge'
import Autolinker from 'autolinker'
import CodeArea from '../codeArea'
import Panel, { Collapse } from '../compatPanel'
import HumanReadableTime from 'human-readable-time'
import Modal from '../compatModal'
import Moment from 'moment'
import { notifySuccess, notifyFailure } from '../../utilities/notifier'
import React, { Component } from 'react'
import { subscribeIpc, unsubscribeIpc } from '../../utilities/ipcSubscriptions'
import { t } from '../../utilities/i18n'
import TagBadges from '../tagBadges'
import { toggleMarkdownTaskListItem } from '../../utilities/markdown/taskList'
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
  selectGistTag,
  updateFileExpandStatus,
  updateGistDeleteModeStatus,
  updateGistEditModeStatus,
  updateGistRawModal,
  updateGistTags,
  updateSingleGist,
} from '../../actions'
import {
  DELETE_SINGLE_GIST,
  EDIT_SINGLE_GIST,
  getGitHubApi,
} from '../../utilities/githubApi'

import './index.scss'

import editIcon from './ei-edit.svg'
import eyeIcon from './ei-eye.svg'
import openInWebIcon from './ei-share.svg'
import secretIcon from './lock.svg'
import tagsIcon from './tags.svg'
import trashIcon from './ei-trash.svg'

const clipboard = electronBridge.clipboard
const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

const kIsExpanded = conf.get('snippet:expanded')
const kTabLength = conf.get('editor:tabSize')

class Snippet extends Component {
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
    getGitHubApi(DELETE_SINGLE_GIST)(
      accessToken,
      activeGist)
      .catch(err => {
        logger.error('Failed to delete the gist ' + activeGist)
        logger.error(JSON.stringify(err))
        notifyFailure(t('notification.deletionFailed'), t('notification.networkFailure', { code: '02' }))
      })
      .then(data => {
        logger.info('The gist ' + activeGist + ' has been deleted.')
        notifySuccess(t('notification.gistDeleted'))

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
        notifyFailure(t('notification.gistUpdateFailed'))
        logger.error(JSON.stringify(err))
      })
      .then((response) => {
        this.updateGistsStoreWithUpdatedGist(response)
      })
  }

  handleMarkdownTaskListItemToggle (activeSnippet, gistFile, taskIndex, checked) {
    const { accessToken, activeGist } = this.props
    const updatedContent = toggleMarkdownTaskListItem(gistFile.content, taskIndex, checked)

    if (updatedContent === gistFile.content) {
      return Promise.resolve()
    }

    return getGitHubApi(EDIT_SINGLE_GIST)(
      accessToken,
      activeGist,
      activeSnippet.details.description,
      {
        [gistFile.filename]: {
          content: updatedContent
        }
      })
      .catch((err) => {
        notifyFailure(t('notification.gistUpdateFailed'))
        logger.error(JSON.stringify(err))
        throw err
      })
      .then((response) => {
        this.updateGistsStoreWithUpdatedGist(response)
      })
  }

  updateGistsStoreWithUpdatedGist (gistDetails) {
    const {
      gists, activeGist, gistTags, activeGistTag, updateSingleGist,
      updateGistTags, selectGistTag, searchIndex
    } = this.props

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
      // leave a space in between to help tokenization
      filenameRecords += ', ' + filename
      const file = files[filename]
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
    const link = snippet.details.html_url + '#file-' + file.filename.replace(/\./g, '-').toLowerCase()
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
    return (
      <div className='header-table'>
        <div className='line'>
          <div className='header-title'>
            { activeSnippet.brief.public
              ? t('snippet.publicGist')
              : [
                <div key='icon'className='secret-icon' dangerouslySetInnerHTML={{ __html: secretIcon }} />,
                <span key='description' >{ t('snippet.secretGist') }</span>
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
            <a className='snippet-control'
              title={ t('snippet.revisions') }
              href={ activeSnippet.brief.html_url + '/revisions' }>
              <div dangerouslySetInnerHTML={{ __html: eyeIcon }} />
            </a>
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
    const { title, description, customTags } = descriptionParser(gist.brief.description)
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
          { t('snippet.lastActive', { time: Moment(gist.brief.updated_at).fromNow() }) }
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
      // fileExpandStatus list. Therefore, its value is undefined. We consider
      // it in the default status(either expanded or collapsed, depending on
      // settings in .leptonrc).
      fileExpandStatus[key] = !kIsExpanded
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
        // undefined should be treated as the default value as explained above
        let isExpanded = kIsExpanded
        if (fileExpandStatus[expandStatusKey] === false) {
          isExpanded = false
        } else if (fileExpandStatus[expandStatusKey] === true) {
          isExpanded = true
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
            <Collapse in={ isExpanded }>
              <div className='collapsable-code-area'>
                <CodeArea
                  filename={gistFile.filename}
                  content={gistFile.content}
                  language={gistFile.language}
                  kTabLength={kTabLength}
                  onMarkdownTaskListItemToggle={ this.handleMarkdownTaskListItemToggle.bind(this, activeSnippet, gistFile) }/>
              </div>
            </Collapse>
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <Panel className='snippet-code'
          bsStyle={ activeSnippet.brief.public ? 'default' : 'danger' }>
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
