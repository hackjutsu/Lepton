'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { logoutUserSession, removeAccessToken } from '../../actions/index'
import { bindActionCreators } from 'redux'
import { Button, Image, Modal } from 'react-bootstrap'
import './index.scss'

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

  closeLoginModal () {
    this.setState({
      showLoginModal: false,
      loggedInUserToken: null,
      loggedInUserName: null
    })
  }

  handleLoginClickedYes () {
    console.log('User clicked no')
    this.props.launchAuthWindow(this.state.loggedInUserToken)
    this.closeLoginModal()
  }

  handleLoginClickedNo () {
    console.log('User clicked yes')
    this.props.launchAuthWindow(null)
    this.closeLoginModal()
  }

  renderLoginModal () {
    return (
      <Modal className='login-modal' show={ this.state.showLoginModal } onHide={ this.closeLoginModal.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>Login Modal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{ this.state.loggedInUserName ? 'Are you ' + this.state.loggedInUserName : '' }</p>
          <Button onClick={ this.handleLoginClickedYes.bind(this) }>YES</Button>
          <Button onClick={ this.handleLoginClickedNo.bind(this) }>NO</Button>
        </Modal.Body>
      </Modal>
    )
  }

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
    console.log('** Login clicked')
    let loggedInUserInfo = this.props.getLoggedInUserInfo()
    console.log('loggedInUserInfo is ' + loggedInUserInfo)


    this.setState({
      showLoginModal: true,
      loggedInUserToken: loggedInUserInfo ? loggedInUserInfo.token : null,
      loggedInUserName: loggedInUserInfo ? loggedInUserInfo.profile : null
    })

    console.log('!!' + this.state.showLoginModal)
  }

  handleLogoutClicked () {
    console.log('** Logout clicked')
    console.log('** dispatch logoutUserSession')
    this.props.logoutUserSession()
    this.props.updateLocalStorage({
      token: null,
      profile: null
    })
    removeAccessToken()
  }

  handleSyncClicked () {
    console.log('** Sync clicked')
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
