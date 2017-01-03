'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import './index.scss'

class UserPanel extends Component {

  handleLoginClicked() {
    console.log('** Login clicked')
    this.props.launchAuthWindow()
  }

  handleLogoutClicked() {
	console.log('** Logout clicked')
  }

  renderProfile() {
    let profile = this.props.userSession.profile
    if (!profile) {
      return
    }

    return (
      <div><img src={ profile.avatar_url } className='profile-image' /></div>
    )
  }

  render () {
    return (
      <div className='user-panel'>
        <button type="button" className='user-session-button'
		  onClick={ () => this.handleLoginClicked() }>LOGIN</button>
        <button type="button" className='user-session-button'
		  onClick={ () => this.handleLogoutClicked() }>LOGOUT</button>
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

export default connect(mapStateToProps)(UserPanel)
