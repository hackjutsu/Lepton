'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { Button, Image, Modal } from 'react-bootstrap'
import GistEditorForm from '../gistEditorForm'
import { NEW_GIST } from '../gistEditorForm'
import defaultImage from './github.jpg'
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
} from '../../utilities/gitHubApi'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

class UserPanel extends Component {

  constructor (props) {
    super(props)

    this.state = {
      showGistEditorModal: false,
      showLoginModal: false,
      loggedInUserToken: null,
      loggedInUserName: null,
      loggedInUserImage: null
    }
  }

  componentWillMount () {
    let loggedInUserInfo = this.props.getLoggedInUserInfo()

    this.setState({
      showLoginModal: true,
      loggedInUserToken: loggedInUserInfo ? loggedInUserInfo.token : null,
      loggedInUserName: loggedInUserInfo ? loggedInUserInfo.profile : null,
      loggedInUserImage: loggedInUserInfo ? loggedInUserInfo.image : null,
    })
  }

  closeLoginModal () {
    this.setState({
      showLoginModal: false
    })
  }

  handleLoginClickedYes () {
    this.props.launchAuthWindow(this.state.loggedInUserToken)
    this.closeLoginModal()
  }

  handleLoginClickedNo () {
    this.props.launchAuthWindow(null)
    this.closeLoginModal()
  }

  renderLoginModalBody () {
    if (this.state.loggedInUserName === null ||
      this.state.loggedInUserName === 'null') {
      return (
        <center>
          <div>
            <div>
                <Image className='profile-image-modal' src={ defaultImage } rounded></Image>
            </div>
            <div className='button-group-modal'>
              <Button className='button-modal' onClick={ this.handleLoginClickedNo.bind(this) }>GitHub Login</Button>
            </div>
          </div>
        </center>
      )
    }

    return (
      <center>
        <div>
          <Image className='profile-image-modal' src={ this.state.loggedInUserImage } rounded></Image>
        </div>
        <div className='button-group-modal'>
          <Button className='button-modal' bsStyle="success" onClick={ this.handleLoginClickedYes.bind(this) }>Continue as { this.state.loggedInUserName }</Button>
          <br/>
          <Button className='button-modal' onClick={ this.handleLoginClickedNo.bind(this) }>Switch Account</Button>
        </div>
      </center>
    )
  }

  renderLoginModal () {
    return (
      <Modal bsSize="small" show={ this.state.showLoginModal } onHide={ this.closeLoginModal.bind(this)}>
        <Modal.Header>
          <Modal.Title>Login</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          { this.renderLoginModalBody() }
        </Modal.Body>
      </Modal>
    )
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

  // TODO: It might be better to use Array instead of Set each lang
  updateGistsStoreWithNewGist (gistDetails) {
    let gistId = gistDetails.id
    logger.debug('The new gist id is ' + gistId)
    let files = gistDetails.files

    let langs = new Set()
    let langTags = this.props.langTags
    langTags.All.unshift(gistId)
    Object.keys(files).forEach(filename => {
      let file = files[filename]
      let language = file.language
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
    logger.info('** dispatch updateSingleGist')
    this.props.updateSingleGist(newGist)

    logger.info('** dispatch updateLangTags')
    this.props.updateLangTags(langTags)

    logger.info('** dispatch selectLangTag')
    this.props.selectLangTag('All')

    logger.info('** dispatch selectGist')
    this.props.selectGist(gistId)
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

  renderOutSection () {
    return (
      <div>
        { this.renderLoginModal() }
        <a href='#'
          className='customized-tag'
          onClick={ this.handleLoginClicked.bind(this) }>
          #login
        </a>
      </div>
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

  handleLoginClicked () {
    let loggedInUserInfo = this.props.getLoggedInUserInfo()

    this.setState({
      showLoginModal: true,
      loggedInUserToken: loggedInUserInfo ? loggedInUserInfo.token : null,
      loggedInUserName: loggedInUserInfo ? loggedInUserInfo.profile : null,
      loggedInUserImage: loggedInUserInfo ? loggedInUserInfo.image : null,
    })
  }

  handleLogoutClicked () {
    logger.info('** dispatch logoutUserSession')
    this.props.logoutUserSession()
    this.props.updateLocalStorage({
      token: null,
      profile: null,
      image: null
    })
    removeAccessToken()

    this.setState({
      showLoginModal: true,
      loggedInUserToken: null,
      loggedInUserName: null,
      loggedInUserImage: null
    })
  }

  handleNewGistClicked () {
    logger.debug('handleNewGistClicked is called')
    logger.debug('Showing the gist editor modal.')
    this.setState({
      showGistEditorModal: true
    })
  }

  handleSyncClicked () {
    this.props.reSyncUserGists()
  }

  renderProfile () {
    let profile = this.props.userSession.profile
    if (!profile || this.props.userSession.active === 'false') {
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
        </div>
        { this.props.userSession.active === 'true'
            ? this.renderInSection()
            : this.renderOutSection() }
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
