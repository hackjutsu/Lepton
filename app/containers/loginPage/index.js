import { Alert, Button, Image, Modal, ProgressBar } from 'react-bootstrap'
import { connect } from 'react-redux'
import { remote, ipcRenderer } from 'electron'
import React, { Component } from 'react'

import dojocatImage from '../../utilities/octodex/dojocat.jpg'
import privateinvestocatImage from '../../utilities/octodex/privateinvestocat.jpg'

import './index.scss'

const conf = remote.getGlobal('conf')
const logger = remote.getGlobal('logger')

const LoginModeEnum = { CREDENTIALS: 1, TOKEN: 2 }

let defaultImage = dojocatImage
if (conf.get('enterprise:enable')) {
  defaultImage = privateinvestocatImage
  if (conf.get('enterprise:avatarUrl')) {
    defaultImage = conf.get('enterprise:avatarUrl')
  }
}

class LoginPage extends Component {
  constructor (props) {
    super(props)
    this.state = {
      inputTokenValue: '',
      loginMode: LoginModeEnum.CREDENTIALS
    }
  }

  componentWillMount () {
    const { loggedInUserInfo } = this.props
    logger.debug('-----> Inside LoginPage componentWillMount with loggedInUserInfo' + JSON.stringify(loggedInUserInfo))

    this.setState({
      cachedImage: this.resolveCachedImage(loggedInUserInfo),
    })

    logger.debug('-----> Registering listener for auto-login signal')
    ipcRenderer.on('auto-login', () => {
      logger.debug('-----> Received "auto-login" signal with loggedInUserInfo ' + JSON.stringify(loggedInUserInfo))
      loggedInUserInfo && loggedInUserInfo.token && this.handleContinueButtonClicked()
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

  handleTokenLoginButtonClicked (token) {
    if (token && this.props.authWindowStatus === 'OFF') {
      this.props.launchAuthWindow(token)
    }
  }

  handleLoginModeSwitched () {
    if (this.state.loginMode === LoginModeEnum.CREDENTIALS) {
      this.setState({
        loginMode: LoginModeEnum.TOKEN
      })
    } else {
      this.setState({
        loginMode: LoginModeEnum.CREDENTIALS
      })
    }
  }

  renderControlSection () {
    const { authWindowStatus, loggedInUserInfo, userSessionStatus } = this.props
    const { loginMode } = this.state
    const loggedInUserName = loggedInUserInfo ? loggedInUserInfo.profile : null
    const welcomeMessage = 'Lepton is FREE. Like us on GitHub! ⭐'

    if (userSessionStatus === 'IN_PROGRESS') {
      return (
        <div className='button-group-modal'>
          <ProgressBar active now={ 100 }/>
          <div className="login-page-text-link">
            <a href="https://github.com/hackjutsu/Lepton"><strong>{ welcomeMessage }</strong></a>
          </div>
        </div>
      )
    }

    if (conf.get('enterprise:enable')) {
      return (
        <div className='button-group-modal'>
          <Button
            autoFocus
            className='modal-button'
            bsStyle="default"
            onClick={ this.handleContinueButtonClicked.bind(this) }>
            { loggedInUserName ? `Continue as ${loggedInUserName}` : 'HAPPY CODING' }
          </Button>
          <div className="login-page-footer">
            <a href="https://github.com/hackjutsu/Lepton">{ welcomeMessage }</a>
          </div>
        </div>
      )
    }

    if (userSessionStatus === 'EXPIRED' || userSessionStatus === 'INACTIVE' ||
      loggedInUserName === null || loggedInUserName === 'null') {
      return (
        <div className='button-group-modal'>
          <div className="login-page-text-link">
            <a href="https://github.com/hackjutsu/Lepton">{ welcomeMessage }</a>
          </div>
          { loginMode === LoginModeEnum.CREDENTIALS
            ? this.renderCredentialLoginSection(authWindowStatus, userSessionStatus)
            : this.renderTokenLoginSection(userSessionStatus)
          }
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

  updateInputValue (evt) {
    this.setState({
      inputTokenValue: evt.target.value
    })
  }

  renderCredentialLoginSection (authWindowStatus, userSessionStatus) {
    return (
      <div>
        { userSessionStatus === 'EXPIRED'
          ? <Alert bsStyle="warning" className="login-alert">Token invalid</Alert>
          : null
        }
        <Button
          autoFocus
          className={ authWindowStatus === 'OFF' ? 'modal-button' : 'modal-button-disabled' }
          onClick={ this.handleLoginClicked.bind(this) }>
            GitHub Login
        </Button>
        <div className="login-page-text-link">
          <a href="#" onClick={ this.handleLoginModeSwitched.bind(this) }>Switch to token?</a>
        </div>
      </div>
    )
  }

  renderTokenLoginSection (userSessionStatus) {
    return (
      <form>
        { userSessionStatus === 'EXPIRED'
          ? <Alert bsStyle="warning" className="login-alert">Token invalid</Alert>
          : null
        }
        <input
          className="form-control"
          value={ this.state.inputTokenValue }
          onChange={ this.updateInputValue.bind(this) }
        />
        <Button
          autoFocus
          className='modal-button'
          onClick={ this.handleTokenLoginButtonClicked.bind(this, this.state.inputTokenValue) }>
            Token Login
        </Button>
        <div className="login-page-text-link">
          <a href="#" onClick={ this.handleLoginModeSwitched.bind(this) }>Switch to credentials?</a>
        </div>
      </form>
    )
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
