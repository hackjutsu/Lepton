import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { default as GistEditorForm, NEW_GIST } from '../gistEditorForm'
import { Image, Button, ProgressBar } from 'react-bootstrap'
import electronBridge from '../../utilities/electronBridge'
import HumanReadableTime from 'human-readable-time'
import Modal from '../compatModal'
import { notifySuccess, notifyFailure } from '../../utilities/notifier'
import React, { Component } from 'react'
import { subscribeIpc, unsubscribeIpc } from '../../utilities/ipcSubscriptions'
import { t } from '../../utilities/i18n'
import {
  addLangPrefix as Prefixed,
  descriptionParser,
  parseCustomTags,
} from '../../utilities/parser'
import {
  logoutUserSession,
  removeAccessToken,
  selectGist,
  selectGistTag,
  updateGistNewModeStatus,
  updateGistTags,
  updateLogoutModalStatus,
  updateSingleGist,
} from '../../actions/index'
import {
  CREATE_SINGLE_GIST,
  getGitHubApi,
} from '../../utilities/githubApi'

import './index.scss'

import dojocatImage from '../../utilities/octodex/dojocat.jpg'
import logoutIcon from './logout.svg'
import newIcon from './new.svg'
import privateinvestocatImage from '../../utilities/octodex/privateinvestocat.jpg'
import syncIcon from './sync.svg'

const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

let defaultImage = dojocatImage
if (conf.get('enterprise:enable')) {
  defaultImage = privateinvestocatImage
  if (conf.get('enterprise:avatarUrl')) {
    defaultImage = conf.get('enterprise:avatarUrl')
  }
}

const kIsPrivate = conf.get('snippet:newSnippetPrivate')
const hideProfilePhoto = conf.get('userPanel:hideProfilePhoto')

class UserPanel extends Component {
  componentDidMount () {
    this.ipcSubscriptions = []
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'new-gist-renderer', () => {
      this.handleNewGistClicked()
    })
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'exit-editor', () => {
      this.closeGistEditorModal()
    })
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'sync-gists', () => {
      this.handleSyncClicked()
    })
  }

  componentWillUnmount () {
    unsubscribeIpc(this.ipcSubscriptions)
  }

  handleCreateSingleGist (data) {
    const isPublic = data.private === undefined ? true : !data.private
    const description = data.description.trim()
    const processedFiles = {}

    data.gistFiles.forEach((file) => {
      processedFiles[file.filename.trim()] = {
        content: file.content
      }
    })

    return getGitHubApi(CREATE_SINGLE_GIST)(this.props.accessToken, description, processedFiles, isPublic)
      .catch((err) => {
        notifyFailure(t('notification.gistCreationFailed'))
        logger.error(JSON.stringify(err))
      })
      .then((response) => {
        this.updateGistsStoreWithNewGist(response)
      })
      .finally(() => {
        this.closeGistEditorModal()
      })
  }

  updateGistsStoreWithNewGist (gistDetails) {
    const {
      gistTags,
      updateSingleGist,
      updateGistTags,
      selectGistTag,
      selectGist,
      searchIndex
    } = this.props

    const gistId = gistDetails.id
    const files = gistDetails.files

    // update the language tags
    const langs = new Set()
    let filenameRecords = ''

    gistTags[Prefixed('All')].unshift(gistId)
    Object.keys(files).forEach(filename => {
      // leave a space in between to help tokenization
      filenameRecords += ', ' + filename
      const language = files[filename].language || 'Other'
      langs.add(language)
      const prefixedLang = Prefixed(language)
      if (Object.prototype.hasOwnProperty.call(gistTags, prefixedLang)) {
        gistTags[prefixedLang].unshift(gistId)
      } else {
        gistTags[prefixedLang] = []
        gistTags[prefixedLang].unshift(gistId)
      }
    })

    // update the custom tags
    const customTags = parseCustomTags(descriptionParser(gistDetails.description).customTags)
    customTags.forEach(tag => {
      if (Object.prototype.hasOwnProperty.call(gistTags, tag)) {
        gistTags[tag].unshift(gistDetails.id)
      } else {
        gistTags[tag] = []
        gistTags[tag].unshift(gistDetails.id)
      }
    })

    const newGist = {}
    newGist[gistId] = {
      langs: langs,
      brief: gistDetails,
      details: gistDetails
    }
    logger.info('[Dispatch] updateSingleGist')
    updateSingleGist(newGist)

    logger.info('[Dispatch] updateGistTags')
    updateGistTags(gistTags)

    logger.info('[Dispatch] selectGistTag')
    selectGistTag(Prefixed('All'))

    logger.info('[Dispatch] selectGist')
    selectGist(gistId)

    let langSearchRecords = ''
    langs.forEach(lang => {
      langSearchRecords += ',' + lang
    })

    // update the search index
    searchIndex.addToFuseIndex({
      id: gistId,
      description: gistDetails.description,
      language: langSearchRecords,
      filename: filenameRecords
    })

    notifySuccess(t('notification.gistCreated'), HumanReadableTime(new Date()))
  }

  renderGistEditorModalBody () {
    const initialData = {
      description: '',
      private: kIsPrivate,
      gists: [
        { filename: '', content: '' }
      ]
    }
    return (
      <GistEditorForm
        initialData={ initialData }
        formStyle={ NEW_GIST }
        handleCancel = { this.closeGistEditorModal.bind(this) }
        onSubmit={ this.handleCreateSingleGist.bind(this) }></GistEditorForm>
    )
  }

  renderGistEditorModal () {
    return (
      <Modal
        bsSize='large'
        dialogClassName='new-modal'
        animation={ false }
        backdrop='static'
        keyboard={ false }
        show={ this.props.gistNewModalStatus === 'ON' }
        onHide={ this.closeGistEditorModal.bind(this)}>
        <Modal.Header closeButton>
          <Modal.Title>{ t('userPanel.new') }</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          { this.renderGistEditorModalBody.bind(this)() }
        </Modal.Body>
      </Modal>
    )
  }

  renderInSection () {
    return (
      <div>
        { this.renderGistEditorModal() }
        <a href='#'
          className='user-panel-button'
          onClick={ this.handleLogoutClicked.bind(this) }>
          <div
            className='user-panel-icon'
            dangerouslySetInnerHTML={{ __html: logoutIcon }} />
          <span>{ t('userPanel.logout') }</span>
        </a>
        <br/>
        <a href='#'
          className='user-panel-button'
          onClick={ this.handleNewGistClicked.bind(this) }>
          <div
            className='user-panel-icon'
            dangerouslySetInnerHTML={{ __html: newIcon }} />
          <span>{ t('userPanel.new') }</span>
        </a>
        <br/>
        <a href='#'
          className='user-panel-button'
          onClick={ this.handleSyncClicked.bind(this) }>
          <div
            className='user-panel-icon'
            dangerouslySetInnerHTML={{ __html: syncIcon }} />
          <span>{ t('userPanel.sync') }</span>
        </a>
        <div className='customized-tag-small'>{ this.props.syncTime }</div>
      </div>
    )
  }

  handleLogoutClicked () {
    this.props.updateLogoutModalStatus('ON')
  }

  handleNewGistClicked () {
    this.props.updateGistNewModeStatus('ON')
  }

  closeGistEditorModal () {
    this.props.updateGistNewModeStatus('OFF')
  }

  handleSyncClicked () {
    this.props.reSyncUserGists()
  }

  handleLogoutModalCancelClicked () {
    this.props.updateLogoutModalStatus('OFF')
  }

  handleLogoutModalConfirmClicked () {
    logger.info('[Dispatch] logoutUserSession')
    this.props.updateLogoutModalStatus('OFF')
    this.props.logoutUserSession()
    this.props.updateLocalStorage({
      token: null,
      profile: null
    })
    removeAccessToken()
    electronBridge.window.setTitle('Lepton') // update the app title
    ipcRenderer.send('session-destroyed')
  }

  renderProfile () {
    const { profile, activeStatus } = this.props.userSession
    if (hideProfilePhoto || !profile || activeStatus === 'INACTIVE') {
      return
    }

    let avatarUrl = profile.avatar_url
    if (conf.get('enterprise:enable')) {
      avatarUrl = defaultImage
    }

    return (
      <div>
        <figure className="sticker-img">
          <Image
            className='profile-image-section'
            src={ avatarUrl }/>
          <div>
            <div className='profile-username-section'>
              <h5><span>{ this.props.userSession.profile.login }</span></h5>
            </div>
            <div className="curl"></div>
            <a href={ this.props.userSession.profile.html_url }></a>
          </div>
        </figure>
      </div>
    )
  }

  renderLogoutConfirmationModal () {
    return (
      <div className='static-modal'>
        <Modal className='logout-modal' show={ this.props.logoutModalStatus === 'ON' } bsSize='small'>
          <Modal.Header>
            <Modal.Title>{ t('userPanel.confirmLogout') }</Modal.Title>
          </Modal.Header>
          <Modal.Footer>
            <Button onClick={ this.handleLogoutModalCancelClicked.bind(this) }>{ t('editor.cancel') }</Button>
            <Button
              bsStyle='danger'
              onClick={ this.handleLogoutModalConfirmClicked.bind(this) }>{ t('userPanel.logoutAction') }</Button>
          </Modal.Footer>
        </Modal>
      </div>
    )
  }

  render () {
    return (
      <div className='user-panel'>
        <div>
          { this.renderProfile() }
          { this.props.gistSyncStatus === 'IN_PROGRESS'
            ? <ProgressBar className='resync-progress-bar' active now={ 100 }/>
            : null }
        </div>
        { this.renderInSection() }
        { this.renderLogoutConfirmationModal() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    userSession: state.userSession,
    syncTime: state.syncTime,
    accessToken: state.accessToken,
    gistTags: state.gistTags,
    gistSyncStatus: state.gistSyncStatus,
    logoutModalStatus: state.logoutModalStatus,
    gistNewModalStatus: state.gistNewModalStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    logoutUserSession: logoutUserSession,
    updateSingleGist: updateSingleGist,
    updateGistTags: updateGistTags,
    selectGistTag: selectGistTag,
    selectGist: selectGist,
    updateGistNewModeStatus: updateGistNewModeStatus,
    updateLogoutModalStatus: updateLogoutModalStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(UserPanel)
