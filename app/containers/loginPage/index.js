'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Button, Image, Modal } from 'react-bootstrap'
import defaultImage from './github.jpg'

import './index.scss'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

class LoginPage extends Component {

  componentWillMount () {
    let loggedInUserInfo = this.props.getLoggedInUserInfo()

    this.setState({
      loggedInUserToken: loggedInUserInfo ? loggedInUserInfo.token : null,
      loggedInUserName: loggedInUserInfo ? loggedInUserInfo.profile : null,
      loggedInUserImage: loggedInUserInfo ? loggedInUserInfo.image : null,
    })
  }

  handleLoginClicked () {
    if (this.props.authWindowStatus === 'OFF') {
      this.props.launchAuthWindow()
    }
  }

  handleContinueButtonClicked () {
    if (this.props.authWindowStatus === 'OFF') {
      this.props.launchAuthWindow(this.state.loggedInUserToken)
    }
  }

  renderLoginModalBody () {
    let { loggedInUserName, loggedInUserImage } = this.state
    let { authWindowStatus } = this.props
    logger.debug(authWindowStatus)
    if (loggedInUserName === null || loggedInUserName === 'null') {
      return (
        <center>
          <div>
            <Image className='profile-image-modal' src={ defaultImage } rounded/>
          </div>
          <div className='button-group-modal'>
            <Button
              className={ authWindowStatus === 'OFF' ? 'modal-button' : 'modal-button-disabled' }
              onClick={ this.handleLoginClicked.bind(this) }>
              GitHub Login
            </Button>
          </div>
        </center>
      )
    }

    return (
      <center>
        <div>
          <Image className='profile-image-modal' src={ loggedInUserImage } rounded/>
        </div>
        <div className='button-group-modal'>
          <Button
            className='modal-button'
            bsStyle="success"
            onClick={ this.handleContinueButtonClicked.bind(this) }>
            Continue as { loggedInUserName }
          </Button>
          <br/>
          <Button
            className={ authWindowStatus === 'OFF' ? 'modal-button' : 'modal-button-disabled' }
            onClick={ this.handleLoginClicked.bind(this) }>
            Switch Account
          </Button>
        </div>
      </center>
    )
  }

  render () {
    return (
      <div className='login-modal'>
        <Modal.Dialog bsSize='small'>
          <Modal.Header>
            <Modal.Title>Login</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            { this.renderLoginModalBody() }
          </Modal.Body>
      </Modal.Dialog>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    authWindowStatus: state.authWindowStatus
  }
}

export default connect(mapStateToProps)(LoginPage)
