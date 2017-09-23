'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { ipcRenderer } from 'electron'
import { Alert, Button, Image, Modal, ProgressBar } from 'react-bootstrap'
import defaultImage from './github.jpg'

import './index.scss'

class LoginPage extends Component {
  componentWillMount () {
    const loggedInUserInfo = this.props.getLoggedInUserInfo()

    this.setState({
      loggedInUserToken: loggedInUserInfo ? loggedInUserInfo.token : null,
      loggedInUserName: loggedInUserInfo ? loggedInUserInfo.profile : null,
      loggedInUserImage: loggedInUserInfo ? loggedInUserInfo.image : null,
    })

    ipcRenderer.on('auto-login', () => {
      this.state.loggedInUserToken && this.handleContinueButtonClicked()
    })
  }

  componentWillUnmount () {
    ipcRenderer.removeAllListeners('auto-login')
  }

  handleLoginClicked () {
    if (this.props.authWindowStatus === 'OFF') {
      this.setState({
        loggedInUserImage: defaultImage
      })
      this.props.launchAuthWindow()
    }
  }

  handleContinueButtonClicked () {
    if (this.props.authWindowStatus === 'OFF') {
      this.props.launchAuthWindow(this.state.loggedInUserToken)
    }
  }

  renderControlSection () {
    const { loggedInUserName } = this.state
    const { authWindowStatus, userSessionStatus } = this.props

    if (userSessionStatus === 'IN_PROGRESS') {
      return (
        <div className='button-group-modal'>
          <ProgressBar active now={ 100 }/>
        </div>
      )
    }

    if (userSessionStatus === 'EXPIRED' || userSessionStatus === 'INACTIVE' ||
      loggedInUserName === null || loggedInUserName === 'null') {
      return (
        <div className='button-group-modal'>
          { userSessionStatus === 'EXPIRED'
            ? <Alert bsStyle="warning">
              <strong>Token expired.</strong> Please login again.
            </Alert>
            : null }
          <Button
            autoFocus
            className={ authWindowStatus === 'OFF' ? 'modal-button' : 'modal-button-disabled' }
            onClick={ this.handleLoginClicked.bind(this) }>
            GitHub Login
          </Button>
        </div>
      )
    }

    return null

    // Uncomment this block if we want the "Continue as { loggedInUserName }" button shown up
    // Other than logging in automatically.
    // return (
    //   <div className='button-group-modal'>
    //     <Button
    //       autoFocus
    //       className='modal-button'
    //       bsStyle="success"
    //       onClick={ this.handleContinueButtonClicked.bind(this) }>
    //       Continue as { loggedInUserName }
    //     </Button>
    //     <br/>
    //     <Button
    //       className={ authWindowStatus === 'OFF' ? 'modal-button' : 'modal-button-disabled' }
    //       onClick={ this.handleLoginClicked.bind(this) }>
    //       Switch Account
    //     </Button>
    //   </div>
    // )
  }

  renderLoginModalBody () {
    const { loggedInUserName, loggedInUserImage } = this.state

    let profileImage = loggedInUserImage || defaultImage
    if (loggedInUserName === null || loggedInUserName === 'null') {
      profileImage = defaultImage
    }

    return (
      <center>
        <div>
          <Image className='profile-image-modal' src={ profileImage } rounded/>
        </div>
        { this.renderControlSection() }
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
    authWindowStatus: state.authWindowStatus,
    userSessionStatus: state.userSession.activeStatus
  }
}

export default connect(mapStateToProps)(LoginPage)
