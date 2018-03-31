'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { remote, ipcRenderer } from 'electron'
import { Alert, Button, Image, Modal, ProgressBar } from 'react-bootstrap'
import dojocatImage from '../../utilities/octodex/dojocat.jpg'
import privateinvestocatImage from '../../utilities/octodex/privateinvestocat.jpg'

import './index.scss'

const conf = remote.getGlobal('conf')
const logger = remote.getGlobal('logger')

let defaultImage = dojocatImage
if (conf.get('enterprise:enable')) {
  defaultImage = privateinvestocatImage
  if (conf.get('enterprise:avatarUrl')) {
    defaultImage = conf.get('enterprise:avatarUrl')
  }
}

class LoginPage extends Component {
  componentWillMount () {
    const { loggedInUserInfo } = this.props
    logger.debug('-----> Inside LoginPage componentWillMount with loggedInUserInfo' + JSON.stringify(loggedInUserInfo))

    this.setState({
      cachedImage: this.resolveCachedImage(loggedInUserInfo),
    })

    logger.debug('-----> Registering listener for auto-login signal')
    ipcRenderer.on('auto-login', () => {
      logger.debug('-----> Received "auto-login" signal with loggedInUserInfo ' + JSON.stringify(loggedInUserInfo))
      loggedInUserInfo && this.handleContinueButtonClicked()
    })

    logger.debug('-----> sending login-page-ready signal')
    ipcRenderer.send('login-page-ready')
  }

  componentWillUnmount () {
    logger.debug('-----> Removing listener for auto-login signal')
    ipcRenderer.removeAllListeners('auto-login')
  }

  resolveCachedImage (info) {
    if (info && info.image && info.image !== 'null') return info.image
    return null
  }

  handleLoginClicked () {
    if (this.props.authWindowStatus === 'OFF') {
      this.setState({
        cachedImage: defaultImage
      })
      this.props.launchAuthWindow()
    }
  }

  handleContinueButtonClicked () {
    const { loggedInUserInfo } = this.props
    logger.debug('-----> Inside LoginPage handleContinueButtonClicked with loggedInUserInfo' + JSON.stringify(loggedInUserInfo))

    let token = null
    if (conf.get('enterprise:enable')) {
      token = conf.get('enterprise:token')
    } else if (loggedInUserInfo) {
      token = loggedInUserInfo.token
    }

    if (this.props.authWindowStatus === 'OFF') {
      this.props.launchAuthWindow(token)
    }
  }

  renderControlSection () {
    const { authWindowStatus, loggedInUserInfo, userSessionStatus } = this.props
    const loggedInUserName = loggedInUserInfo ? loggedInUserInfo.profile : null

    if (userSessionStatus === 'IN_PROGRESS') {
      return (
        <div className='button-group-modal'>
          <ProgressBar active now={ 100 }/>
        </div>
      )
    }

    if (conf.get('enterprise:enable')) {
      return (
        <div className='button-group-modal'>
          <Button
            autoFocus
            className='modal-button'
            bsStyle="success"
            onClick={ this.handleContinueButtonClicked.bind(this) }>
            { loggedInUserName ? `Continue as ${loggedInUserName}` : 'HAPPY CODING' }
          </Button>
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
    const { cachedImage } = this.state
    const { loggedInUserInfo } = this.props
    const loggedInUserName = loggedInUserInfo ? loggedInUserInfo.profile : null

    let profileImage = cachedImage || defaultImage
    if (loggedInUserName === null || loggedInUserName === 'null' || conf.get('enterprise:enable')) {
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
