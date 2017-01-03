'use strict'

import React, { Component } from 'react'
import './index.scss'

class UserPanel extends Component {

  handleLoginClicked() {
    console.log('** Login clicked')
    this.props.launchAuthWindow()
  }

  handleLogoutClicked() {
	console.log('** Logout clicked')
  }

  render () {
    return (
      <div className='user-panel'>
        <button type="button" className='user-session-button'
		  onClick={ () => this.handleLoginClicked() }>LOGIN</button>
        <button type="button" className='user-session-button'
		  onClick={ () => this.handleLogoutClicked() }>LOGOUT</button>
      </div>
    )
  }
}

export default UserPanel
