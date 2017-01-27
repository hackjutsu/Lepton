'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { Image, Modal, ProgressBar } from 'react-bootstrap'
import GistEditorForm from '../gistEditorForm'
import { NEW_GIST } from '../gistEditorForm'
import HumanReadableTime from 'human-readable-time'
import Notifier from '../../utilities/notifier'
import './index.scss'

import {
  removeAccessToken,
  logoutUserSession,
  updateSingleGist,
  updateLangTags,
  selectLangTag,
  selectGist } from '../../actions/index'

import {
  getGitHubApi,
  CREATE_SINGLE_GIST
} from '../../utilities/githubApi'

import { remote, ipcRenderer } from 'electron'
const logger = remote.getGlobal('logger')

class UserPanel extends Component {

  constructor (props) {
    super(props)

    this.keyEvents = ipcRenderer
    this.state = {
      showGistEditorModal: false
    }
  }

  componentWillMount () {
    this.keyEvents.on('new-gist', () => {
      this.handleNewGistClicked()
    })
  }

  componentWillUnmount () {
    this.keyEvents.removeAllListeners('new-gist')
  }

  closeGistEditorModal () {
    this.setState({
      showGistEditorModal: false
    })
  }

  handleCreateSingleGist (data) {
    logger.debug('Form submitted: ' + JSON.stringify(data))
    let isPublic = data.private === undefined ? true : !data.private
    let description = data.description
    let processedFiles = {}

    data.gistFiles.forEach((file) => {
      processedFiles[file.filename] = {
        content: file.content
      }
    })

    getGitHubApi(CREATE_SINGLE_GIST)(this.props.accessToken, description, processedFiles, isPublic)
    .catch((err) => {
      Notifier('Gist creation failed', err)
      logger.error(JSON.stringify(err))
    })
    .then((response) => {
      this.updateGistsStoreWithNewGist(response)
    })
    .finally(() => {
      logger.debug('Closing the editor modal')
      this.closeGistEditorModal()
    })
  }

  updateGistsStoreWithNewGist (gistDetails) {
    let {
      langTags,
      updateSingleGist,
      updateLangTags,
      selectLangTag,
      selectGist,
      searchIndex } = this.props

    let gistId = gistDetails.id
    logger.debug('The new gist id is ' + gistId)
    let files = gistDetails.files

    let langs = new Set()
    langTags.All.unshift(gistId)
    Object.keys(files).forEach(filename => {
      let language = files[filename].language
      langs.add(language)
      if (langTags.hasOwnProperty(language)) {
        langTags[language].unshift(gistId)
      } else {
        langTags[language] = []
        langTags[language].unshift(gistId)
      }
    })

    let newGist = {}
    newGist[gistId] = {
      langs: langs,
      brief: gistDetails,
      details: gistDetails
    }
    logger.info('[Dispatch] updateSingleGist')
    updateSingleGist(newGist)

    logger.info('[Dispatch] updateLangTags')
    updateLangTags(langTags)

    logger.info('[Dispatch] selectLangTag')
    selectLangTag('All')

    logger.info('[Dispatch] selectGist')
    selectGist(gistId)

    // update the search index
    logger.debug('>>>>> updating the search index with ' + gistDetails.description)
    searchIndex.addToIndex({
      id: gistId,
      description: gistDetails.description
    })

    Notifier('Gist created', HumanReadableTime(new Date()))
  }

  renderGistEditorModalBody () {
    let initialData = {
      description: '',
      gists: [
          {filename: '', content: ''}
      ]}
    return (
      <GistEditorForm
        initialData={ initialData }
        formStyle={ NEW_GIST }
        onSubmit={ this.handleCreateSingleGist.bind(this) }></GistEditorForm>
    )
  }

  renderGistEditorModal () {
    return (
      <Modal bsSize="large" show={ this.state.showGistEditorModal } onHide={ this.closeGistEditorModal.bind(this)}>
        <Modal.Header closeButton>
          <Modal.Title>New Gist</Modal.Title>
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
          className='customized-tag'
          onClick={ this.handleLogoutClicked.bind(this) }>
          #logout
        </a>
        <br/><br/>
        <a href='#'
          className='customized-tag'
          onClick={ this.handleNewGistClicked.bind(this) }>
          #new
        </a>
        <br/>
        <a href='#'
          className='customized-tag'
          onClick={ this.handleSyncClicked.bind(this) }>
          #sync
        </a>
        <div className='customized-tag-small'>{ this.props.syncTime }</div>
      </div>
    )
  }

  handleLogoutClicked () {
    logger.info('[Dispatch] logoutUserSession')
    this.props.logoutUserSession()
    this.props.updateLocalStorage({
      token: null,
      profile: null,
      image: null
    })
    removeAccessToken()
  }

  handleNewGistClicked () {
    this.setState({
      showGistEditorModal: true
    })
  }

  handleSyncClicked () {
    this.props.reSyncUserGists()
  }

  renderProfile () {
    let profile = this.props.userSession.profile
    if (!profile || this.props.userSession.activeStatus === 'INACTIVE') {
      return
    }

    return (
      <div><Image className='profile-image-section' src={ profile.avatar_url } rounded/></div>
    )
  }

  render () {
    return (
      <div className='user-panel'>
        <div>
          { this.renderProfile() }
          <ProgressBar
            className={ this.props.gistSyncStatus === 'IN_PROGRESS'
              ? 'resync-progress-bar' : 'resync-progress-bar-hidden' }
            active
            now={ 100 }/>
        </div>
        { this.renderInSection() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    userSession: state.userSession,
    syncTime: state.syncTime,
    accessToken: state.accessToken,
    langTags: state.langTags,
    gistSyncStatus: state.gistSyncStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    logoutUserSession: logoutUserSession,
    updateSingleGist: updateSingleGist,
    updateLangTags: updateLangTags,
    selectLangTag: selectLangTag,
    selectGist: selectGist
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(UserPanel)
