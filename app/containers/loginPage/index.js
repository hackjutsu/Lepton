import { Alert, Button, Image, Modal, ProgressBar } from 'react-bootstrap'
import Avatar from 'boring-avatars'
import { connect } from 'react-redux'
import { remote, ipcRenderer } from 'electron'
import React, { Component } from 'react'

import dojocatImage from '../../utilities/octodex/dojocat.jpg'
import privateinvestocatImage from '../../utilities/octodex/privateinvestocat.jpg'
import saritocatImage from '../../utilities/octodex/saritocat.png'

import './index.scss'

const conf = remote.getGlobal('conf')
const logger = remote.getGlobal('logger')

const LoginModeEnum = { CREDENTIALS: 1, TOKEN: 2 }

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

    logger.debug('-----> Registering listener for auto-login signal')
    ipcRenderer.on('auto-login', () => {
      logger.debug('-----> Received "auto-login" signal with loggedInUserInfo ' + JSON.stringify(loggedInUserInfo))
      loggedInUserInfo && loggedInUserInfo.token && this.handleContinueButtonClicked(loggedInUserInfo.token)
    })

    logger.debug('-----> sending login-page-ready signal')
    ipcRenderer.send('login-page-ready')
  }

  componentWillUnmount () {
    logger.debug('-----> Removing listener for auto-login signal')
    ipcRenderer.removeAllListeners('auto-login')
  }

  handleLoginClicked () {
    if (this.props.authWindowStatus === 'OFF') {
      this.props.launchAuthWindow()
    }
  }

  handleContinueButtonClicked (token) {
    this.handleTokenLoginButtonClicked(token)
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
            <a href="https://github.com/hackjutsu/Lepton">{ welcomeMessage }</a>
          </div>
        </div>
      )
    }

    if (conf.get('enterprise:enable')) {
      const token = conf.get('enterprise:token')
      return (
        <div className='button-group-modal'>
          <div className="login-page-text-link">
            <a href="https://github.com/hackjutsu/Lepton">{ welcomeMessage }</a>
          </div>
          { token
            ? <Button
              autoFocus
              className='modal-button'
              bsStyle="default"
              onClick={ this.handleContinueButtonClicked.bind(this, token) }>
              { loggedInUserName ? `Continue as ${loggedInUserName}` : 'HAPPY CODING' }
            </Button>
            : this.renderTokenLoginSection(false, userSessionStatus)}
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
            : this.renderTokenLoginSection(true, userSessionStatus)
          }
        </div>
      )
    }

    return null
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

  renderTokenLoginSection (showLoginSwitch, userSessionStatus) {
    return (
      <form>
        { userSessionStatus === 'EXPIRED'
          ? <Alert bsStyle="warning" className="login-alert">Token invalid</Alert>
          : null
        }
        <input
          className="form-control"
          placeholder="scope: gist"
          value={ this.state.inputTokenValue }
          onChange={ this.updateInputValue.bind(this) }
        />
        <Button
          autoFocus
          className='modal-button'
          onClick={ this.handleTokenLoginButtonClicked.bind(this, this.state.inputTokenValue) }>
            Token Login
        </Button>
        { showLoginSwitch
          ? <div className="login-page-text-link">
            <a href="#" onClick={ this.handleLoginModeSwitched.bind(this) }>Switch to credentials?</a>
          </div>
          : null}
      </form>
    )
  }

  renderLoginModalBody () {
    return (
      <center>
        { this.renderAvatar() }
        { this.renderControlSection() }
      </center>
    )
  }

  renderAvatar () {
    const { loginMode } = this.state

    if (conf.get('avatar:type') === 'boring') {
      return <a href="https://github.com/hackjutsu/Lepton">
        <Avatar
          size={ 200 }
          name={ Math.random().toString(36).substr(2, 5) }
          square={ false }
          variant={ conf.get('avatar:boringAvatarVariant') }
          colors={ ['#4D3B36', '#EB613B', '#F98F6F', '#C1D9CD', '#F7EADC'] }
        />
      </a>
    } else {
      let profileImage = dojocatImage
      if (conf.get('enterprise:enable')) {
        profileImage = conf.get('enterprise:avatarUrl')
          ? conf.get('enterprise:avatarUrl')
          : privateinvestocatImage
      } else if (loginMode === LoginModeEnum.TOKEN) {
        profileImage = saritocatImage
      }

      return <a href="https://github.com/hackjutsu/Lepton">
        <Image className='profile-image-modal' src={ profileImage } rounded/>
      </a>
    }
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
