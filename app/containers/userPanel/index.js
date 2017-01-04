'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { logoutUserSession, removeAccessToken } from '../../actions/index'
import { bindActionCreators } from 'redux'
import './index.scss'

class UserPanel extends Component {

  renderLoginButton () {
    return (
      <button type="button" className='user-session-button'
        onClick={ () => this.handleLoginClicked() }>LOGIN</button>
    )
  }

  renderLogoutButton () {
    return (
      <button type="button" className='user-session-button'
        onClick={ () => this.handleLogoutClicked() }>LOGOUT</button>
    )
  }

  handleLoginClicked () {
    console.log('** Login clicked')
    this.props.launchAuthWindow()
  }

  handleLogoutClicked () {
    console.log('** Logout clicked')
    console.log('** dispatch logoutUserSession')
    this.props.logoutUserSession()
    removeAccessToken()
  }

  renderProfile () {
    let profile = this.props.userSession.profile
    if (!profile || this.props.userSession.active === 'false') {
      return (
          <div></div>
      )
    }

    return (
      <div><img src={ profile.avatar_url } className='profile-image' /></div>
    )
  }

  render () {
    return (
      <div className='user-panel'>
        { this.props.userSession.active === 'true'
            ? this.renderLogoutButton()
            : this.renderLoginButton() }
        <div>
          { this.renderProfile() }
        </div>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    userSession: state.userSession
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    logoutUserSession: logoutUserSession
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(UserPanel)
