'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { Image, Modal, Button, ProgressBar } from 'react-bootstrap'
import { default as GistEditorForm, NEW_GIST } from '../gistEditorForm'
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
  selectGist,
  updateGistNewModeStatus,
  updateLogoutModalStatus } from '../../actions/index'

import {
  getGitHubApi,
  CREATE_SINGLE_GIST
} from '../../utilities/githubApi'

import { shell, remote, ipcRenderer } from 'electron'
const logger = remote.getGlobal('logger')

class UserPanel extends Component {
  componentWillMount () {
    ipcRenderer.on('new-gist-renderer', () => {
      this.handleNewGistClicked()
    })
  }

  componentWillUnmount () {
    ipcRenderer.removeAllListeners('new-gist-renderer')
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
    const {
      gistTags,
      updateSingleGist,
      updateGistTags,
      selectGistTag,
      selectGist,
      searchIndex } = this.props

    const gistId = gistDetails.id
    const files = gistDetails.files

    // update the language tags
    const langs = new Set()
    let filenameRecords = ''

    gistTags[Prefixed('All')].unshift(gistId)
    Object.keys(files).forEach(filename => {
      filenameRecords = ',' + filename
      const language = files[filename].language || 'Other'
      langs.add(language)
      const prefixedLang = Prefixed(language)
      if (gistTags.hasOwnProperty(prefixedLang)) {
        gistTags[prefixedLang].unshift(gistId)
      } else {
        gistTags[prefixedLang] = []
        gistTags[prefixedLang].unshift(gistId)
      }
    })

    // update the custom tags
    const customTags = parseCustomTags(descriptionParser(gistDetails.description).customTags)
    customTags.forEach(tag => {
      if (gistTags.hasOwnProperty(tag)) {
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

    Notifier('Gist created', HumanReadableTime(new Date()))
  }

  renderGistEditorModalBody () {
    const initialData = {
      description: '',
      gists: [
          {filename: '', content: ''}
      ]}
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
        show={ this.props.gistNewModalStatus === 'ON' }
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
          className='user-panel-button'
          onClick={ this.handleLogoutClicked.bind(this) }>
          <svg viewBox="0 0 50 50" x="0px" y="0px">
        <g strokeMiterlimit="10" strokeWidth="5" strokeLinecap="square" stroke="currentColor" fill="none" transform="matrix(0.416233, 0, 0, 0.416233, 6.18835, 4.188349)">
          <path d="M51.5,72c0,3.72-2.22,6.69-4.94,6.69H23.94c-2.71,0-4.94-3-4.94-6.69V28c0-3.72,2.22-6.69,4.94-6.69H46.56c2.71,0,4.94,3,4.94,6.69" />
          <line className="cls-1" x1="38.82" y1={50} x2="78.24" y2={50} />
          <line className="cls-1" x1="65.58" y1="34.58" x2={81} y2={50} />
          <line className="cls-1" x1="65.58" y1="65.42" x2={81} y2={50} />
        </g>
      </svg>
          <span>Logout</span>
        </a>
        <br/>
        <a href='#'
          className='user-panel-button'
          onClick={ this.handleNewGistClicked.bind(this) }>
          <svg viewBox="0 0 50 50" x="0px" y="0px">
            <path d="M 29.229 9.628 L 15.391 9.628 C 14.331 9.628 13.47 10.491 13.472 11.552 L 13.472 38.453 C 13.472 39.512 14.332 40.372 15.391 40.372 L 34.606 40.372 C 35.668 40.374 36.528 39.513 36.528 38.453 L 36.528 16.904 L 36.528 16.904 Z M 28.84 11.959 L 34.22 17.315 L 28.84 17.315 Z M 34.606 38.453 L 15.391 38.453 L 15.391 11.552 L 26.92 11.552 L 26.92 17.315 C 26.918 18.377 27.78 19.24 28.843 19.238 L 34.606 19.238 Z"/>
          </svg>
          <span>New</span>
        </a>
        <br/>
        <a href='#'
          className='user-panel-button'
          onClick={ this.handleSyncClicked.bind(this) }>
          <svg viewBox="0 0 50 50" x="0px" y="0px" xmlns="http://www.w3.org/2000/svg">
            <path d="M 12.86 25 C 12.86 20.656 16.387 17.133 20.732 17.139 L 26.724 17.139 L 24.169 19.695 C 23.991 19.871 23.991 20.157 24.169 20.334 L 25.127 21.292 C 25.303 21.469 25.59 21.469 25.766 21.292 L 30.708 16.334 C 30.885 16.158 30.885 15.871 30.708 15.695 L 25.766 10.756 C 25.59 10.579 25.303 10.579 25.127 10.756 L 24.169 11.715 C 23.991 11.891 23.991 12.177 24.169 12.354 L 26.724 14.911 L 20.732 14.911 C 12.954 14.907 8.09 23.326 11.978 30.063 C 12.418 30.83 12.961 31.534 13.585 32.159 C 14.2 32.775 15.251 32.493 15.475 31.653 C 15.58 31.264 15.467 30.847 15.183 30.563 C 13.696 29.095 12.859 27.09 12.86 25 Z"/>
            <path d="M 38.58 21.066 C 38.073 19.863 37.337 18.773 36.413 17.852 C 35.8 17.236 34.748 17.518 34.524 18.358 C 34.419 18.747 34.531 19.164 34.816 19.449 C 39.092 23.731 37.13 31.038 31.284 32.599 C 30.622 32.777 29.942 32.864 29.257 32.865 L 23.274 32.865 L 25.83 30.311 C 26.007 30.135 26.007 29.847 25.83 29.671 L 24.871 28.712 C 24.695 28.535 24.409 28.535 24.233 28.712 L 19.291 33.666 C 19.113 33.844 19.113 34.13 19.291 34.307 L 24.233 39.245 C 24.409 39.422 24.695 39.422 24.871 39.245 L 25.83 38.286 C 26.007 38.111 26.007 37.824 25.83 37.648 L 23.274 35.09 L 29.267 35.09 C 36.508 35.09 41.402 27.703 38.58 21.037 Z"/>
          </svg>
          <span>Sync</span>
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

  handleProfileImageClicked () {
    logger.debug('profile image is clicked!! ' + this.props.userSession.profile.html_url)
    shell.openExternal(this.props.userSession.profile.html_url)
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
      profile: null,
      image: null
    })
    removeAccessToken()
  }

  renderProfile () {
    const { profile, activeStatus } = this.props.userSession
    if (!profile || activeStatus === 'INACTIVE') {
      return
    }

    return (
      <div>
        <Image
            className='profile-image-section'
            src={ profile.avatar_url }
            onClick={ this.handleProfileImageClicked.bind(this) }
            rounded/>
      </div>
    )
  }

  renderLogoutConfirmationModal () {
    return (
        <div className='static-modal'>
          <Modal show={ this.props.logoutModalStatus === 'ON' } bsSize='small'>
            <Modal.Header>
              <Modal.Title>Confirm logout?</Modal.Title>
            </Modal.Header>
            <Modal.Footer>
              <Button onClick={ this.handleLogoutModalCancelClicked.bind(this) }>cancel</Button>
              <Button
                bsStyle='danger'
                onClick={ this.handleLogoutModalConfirmClicked.bind(this) }>logout</Button>
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
