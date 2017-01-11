'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { logoutUserSession, removeAccessToken } from '../../actions/index'
import { bindActionCreators } from 'redux'
import { Button, Image, Modal } from 'react-bootstrap'
import './index.scss'
import defaultImage from './github.jpg'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

class UserPanel extends Component {

  constructor (props) {
    super(props)

    this.state = {
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

  renderModalBody () {
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
          { this.renderModalBody() }
        </Modal.Body>
      </Modal>
    )
  }
  //
  // <Modal.Footer>
  //   Login Powered by GitHub
  // </Modal.Footer>

  renderOutSection () {
    return (
      <div>
        { this.renderLoginModal() }
          <a href='#'
            className='customized-button'
            onClick={ this.handleLoginClicked.bind(this) }>
            #login
          </a>
      </div>
    )
  }

  renderInSection () {
    return (
      <div>
        <a href='#'
          className='customized-tag'
          onClick={ this.handleLogoutClicked.bind(this) }>
          #logout
        </a>
        <br/><br/>
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
