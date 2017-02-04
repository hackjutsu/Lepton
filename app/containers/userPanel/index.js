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
  addLangPrefix as Prefixed,
  parseCustomTags,
  descriptionParser } from '../../utilities/parser'

import {
  removeAccessToken,
  logoutUserSession,
  updateSingleGist,
  updateGistTags,
  selectGistTag,
  selectGist } from '../../actions/index'

import {
  getGitHubApi,
  CREATE_SINGLE_GIST
} from '../../utilities/githubApi'

import { shell, remote, ipcRenderer } from 'electron'
const logger = remote.getGlobal('logger')

class UserPanel extends Component {

  constructor (props) {
    super(props)
    this.state = {
      showGistEditorModal: false
    }
  }

  componentWillMount () {
    ipcRenderer.on('new-gist', () => {
      this.handleNewGistClicked()
    })
  }

  componentWillUnmount () {
    ipcRenderer.removeAllListeners('new-gist')
  }

  closeGistEditorModal () {
    this.setState({
      showGistEditorModal: false
    })
  }

  handleCreateSingleGist (data) {
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
      Notifier('Gist creation failed')
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
    let {
      gistTags,
      updateSingleGist,
      updateGistTags,
      selectGistTag,
      selectGist,
      searchIndex } = this.props

    let gistId = gistDetails.id
    let files = gistDetails.files

    // update the language tags
    let langs = new Set()
    gistTags[Prefixed('All')].unshift(gistId)
    Object.keys(files).forEach(filename => {
      let language = files[filename].language || 'Other'
      langs.add(language)
      let prefixedLang = Prefixed(language)
      if (gistTags.hasOwnProperty(prefixedLang)) {
        gistTags[prefixedLang].unshift(gistId)
      } else {
        gistTags[prefixedLang] = []
        gistTags[prefixedLang].unshift(gistId)
      }
    })

    // update the custom tags
    let customTags = parseCustomTags(descriptionParser(gistDetails.description).customTags)
    customTags.forEach(tag => {
      if (gistTags.hasOwnProperty(tag)) {
        gistTags[tag].unshift(gistDetails.id)
      } else {
        gistTags[tag] = []
        gistTags[tag].unshift(gistDetails.id)
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

    logger.info('[Dispatch] updateGistTags')
    updateGistTags(gistTags)

    logger.info('[Dispatch] selectGistTag')
    selectGistTag(Prefixed('All'))

    logger.info('[Dispatch] selectGist')
    selectGist(gistId)

    let langSearchRecords = ''
    langs.forEach(lang => {
      langSearchRecords += ' ' + lang
    })

    // update the search index
    searchIndex.addToIndex({
      id: gistId,
      description: gistDetails.description,
      language: langSearchRecords
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
      <Modal
        bsSize="large"
        dialogClassName="new-modal"
        show={ this.state.showGistEditorModal }
        onHide={ this.closeGistEditorModal.bind(this)}>
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

  handleProfileImageClicked () {
    logger.debug('profile image is clicked!! ' + this.props.userSession.profile.html_url)
    shell.openExternal(this.props.userSession.profile.html_url)
  }

  renderProfile () {
    let profile = this.props.userSession.profile
    if (!profile || this.props.userSession.activeStatus === 'INACTIVE') {
      return
    }

    return (
      <div>
        <Image className='profile-image-section' src={ profile.avatar_url } onClick={ this.handleProfileImageClicked.bind(this) } rounded/>
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
    gistSyncStatus: state.gistSyncStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    logoutUserSession: logoutUserSession,
    updateSingleGist: updateSingleGist,
    updateGistTags: updateGistTags,
    selectGistTag: selectGistTag,
    selectGist: selectGist
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(UserPanel)
