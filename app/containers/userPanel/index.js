'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { logoutUserSession, removeAccessToken } from '../../actions/index'
import { bindActionCreators } from 'redux'
import { Button, Image, Modal } from 'react-bootstrap'
import GistEditorForm from '../gistEditorForm'
import defaultImage from './github.jpg'
import './index.scss'

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

  handleGistEditorFormSubmit (data) {
    logger.debug('Form submitted: ' + JSON.stringify(data))
  }

  renderGistEditorModalBody () {
    return (
      <GistEditorForm onSubmit={ this.handleGistEditorFormSubmit.bind(this) }></GistEditorForm>
    )
  }

  renderGistEditorModal () {
    return (
      <Modal bsSize="large" show={ this.state.showGistEditorModal } onHide={ this.closeGistEditorModal.bind(this)}>
        <Modal.Header>
          <Modal.Title>New Gist</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          { this.renderGistEditorModalBody() }
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
    syncTime: state.syncTime
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    logoutUserSession: logoutUserSession
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(UserPanel)
