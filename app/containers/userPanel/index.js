'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { logoutUserSession, removeAccessToken } from '../../actions/index'
import { bindActionCreators } from 'redux'
import './index.scss'

class UserPanel extends Component {

  renderOutSection () {
    return (
      <button type="button" className='user-session-button'
        onClick={ () => this.handleLoginClicked() }>LOGIN</button>
    )
  }

  renderInSection () {
    return (
      <div>
        <button type="button" className='user-session-button'
          onClick={ () => this.handleLogoutClicked() }>LOGOUT</button>
        <button type="button" className='user-session-button'
          onClick={ () => this.handleSyncClicked() }>Sync</button>
        <a>Last Sync: { this.props.syncTime }</a>
      </div>
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

  handleSyncClicked () {
    console.log('** Sync clicked')
    this.props.reSyncUserGists()
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
            ? this.renderInSection()
            : this.renderOutSection() }
        <div>
          { this.renderProfile() }
        </div>
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
