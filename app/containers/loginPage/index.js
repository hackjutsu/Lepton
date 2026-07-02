import { Alert, Button, Image, ProgressBar } from 'react-bootstrap'
import Avatar from 'boring-avatars'
import { connect } from 'react-redux'
import electronBridge from '../../utilities/electronBridge'
import LanguageSelector from '../languageSelector'
import Modal from '../compatModal'
import React, { Component } from 'react'
import { subscribeIpc, unsubscribeIpc } from '../../utilities/ipcSubscriptions'
import { t } from '../../utilities/i18n'

import dojocatImage from '../../utilities/octodex/dojocat.webp?inline'
import privateinvestocatImage from '../../utilities/octodex/privateinvestocat.webp?inline'
import saritocatImage from '../../utilities/octodex/saritocat.webp?inline'

import './index.scss'

const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

const LoginModeEnum = { CREDENTIALS: 1, TOKEN: 2 }
const LOGIN_MODAL_FLIP_DURATION_MS = 320
const LOGIN_MODAL_FLIP_SWAP_MS = LOGIN_MODAL_FLIP_DURATION_MS / 2

function getFileUrl (filePath) {
  if (!filePath) return null
  const normalizedPath = String(filePath).replace(/\\/g, '/')
  const fileUrlPrefix = normalizedPath[0] === '/' ? 'file://' : 'file:///'
  return fileUrlPrefix + encodeURI(normalizedPath)
}

class LoginPage extends Component {
  constructor (props) {
    super(props)
    this.state = {
      inputTokenValue: '',
      loginMode: LoginModeEnum.CREDENTIALS,
      modalFlipping: false
    }
  }

  componentDidMount () {
    const { loggedInUserInfo } = this.props
    logger.debug('-----> Inside LoginPage componentDidMount with loggedInUserInfo' + JSON.stringify(loggedInUserInfo))

    logger.debug('-----> Registering listener for auto-login signal')
    this.ipcSubscriptions = []
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'auto-login', () => {
      logger.debug('-----> Received "auto-login" signal with loggedInUserInfo ' + JSON.stringify(loggedInUserInfo))
      loggedInUserInfo && loggedInUserInfo.token && this.handleContinueButtonClicked(loggedInUserInfo.token)
    })

    logger.debug('-----> sending login-page-ready signal')
    ipcRenderer.send('login-page-ready')
  }

  componentWillUnmount () {
    logger.debug('-----> Removing listener for auto-login signal')
    unsubscribeIpc(this.ipcSubscriptions)
    clearTimeout(this.loginModeFlipTimer)
    clearTimeout(this.loginModeSwapTimer)
    clearTimeout(this.languageChangeTimer)
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

  handleLoginModeSwitched (event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault()
    if (this.state.modalFlipping) return

    this.setState({ modalFlipping: true })
    this.loginModeSwapTimer = setTimeout(() => {
      this.setState(prevState => ({
        loginMode: prevState.loginMode === LoginModeEnum.CREDENTIALS
          ? LoginModeEnum.TOKEN
          : LoginModeEnum.CREDENTIALS
      }))
    }, LOGIN_MODAL_FLIP_SWAP_MS)
    this.loginModeFlipTimer = setTimeout(() => {
      this.setState({ modalFlipping: false })
    }, LOGIN_MODAL_FLIP_DURATION_MS)
  }

  renderControlSection () {
    const { authWindowStatus, loggedInUserInfo, userSessionStatus } = this.props
    const { loginMode } = this.state
    const loggedInUserName = loggedInUserInfo ? loggedInUserInfo.profile : null
    const welcomeMessage = t('login.welcome')

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
              { loggedInUserName ? t('login.continueAs', { username: loggedInUserName }) : t('login.happyCoding') }
            </Button>
            : this.renderTokenLoginSection(userSessionStatus)}
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
  }

  renderLanguageSelector () {
    return (
      <LanguageSelector
        className='login-language-selector'
        compact
        onBeforeChange={ this.handleLanguageChanging.bind(this) }
        onChangeFailed={ this.handleLanguageChangeFailed.bind(this) }
      />
    )
  }

  handleLanguageChanging () {
    clearTimeout(this.loginModeFlipTimer)
    clearTimeout(this.loginModeSwapTimer)
    this.setState({ modalFlipping: true })
    return new Promise(resolve => {
      this.languageChangeTimer = setTimeout(resolve, LOGIN_MODAL_FLIP_DURATION_MS)
    })
  }

  handleLanguageChangeFailed () {
    this.setState({ modalFlipping: false })
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
          ? <Alert bsStyle="warning" className="login-alert">{ t('login.tokenInvalid') }</Alert>
          : null
        }
        <Button
          autoFocus
          className={ authWindowStatus === 'OFF' ? 'modal-button' : 'modal-button-disabled' }
          onClick={ this.handleLoginClicked.bind(this) }>
          { t('login.githubLogin') }
        </Button>
      </div>
    )
  }

  renderTokenLoginSection (userSessionStatus) {
    return (
      <form>
        { userSessionStatus === 'EXPIRED'
          ? <Alert bsStyle="warning" className="login-alert">{ t('login.tokenInvalid') }</Alert>
          : null
        }
        <input
          className="form-control"
          placeholder={ t('login.tokenPlaceholder') }
          value={ this.state.inputTokenValue }
          onChange={ this.updateInputValue.bind(this) }
        />
        <Button
          autoFocus
          className='modal-button'
          onClick={ this.handleTokenLoginButtonClicked.bind(this, this.state.inputTokenValue) }>
          { t('login.tokenLogin') }
        </Button>
      </form>
    )
  }

  shouldRenderLoginModeSwitch () {
    const { loggedInUserInfo, userSessionStatus } = this.props
    const loggedInUserName = loggedInUserInfo ? loggedInUserInfo.profile : null

    return !conf.get('enterprise:enable') &&
      (userSessionStatus === 'EXPIRED' || userSessionStatus === 'INACTIVE' ||
      loggedInUserName === null || loggedInUserName === 'null')
  }

  renderLoginModeSwitch () {
    if (!this.shouldRenderLoginModeSwitch()) return null

    const label = this.state.loginMode === LoginModeEnum.CREDENTIALS
      ? t('login.switchToToken')
      : t('login.switchToCredentials')
    const icon = this.state.loginMode === LoginModeEnum.CREDENTIALS ? '🔑' : '👤'

    return (
      <button
        aria-label={ label }
        className='login-header-icon login-mode-switch'
        onClick={ this.handleLoginModeSwitched.bind(this) }
        title={ label }
        type='button'>
        <span aria-hidden='true'>{ icon }</span>
      </button>
    )
  }

  renderHeaderActions () {
    return (
      <div className='login-header-actions'>
        { this.renderLoginModeSwitch() }
        { this.renderLanguageSelector() }
      </div>
    )
  }

  renderLoginModalBody () {
    return (
      <center className='login-modal-body-flipper'>
        { this.renderAvatar() }
        { this.renderControlSection() }
        { this.renderLoginStatus() }
      </center>
    )
  }

  renderLoginStatus () {
    const { loginStatus } = this.props
    if (!loginStatus || !loginStatus.message) return null

    const logFileUrl = getFileUrl(loginStatus.logFilePath)
    const className = loginStatus.level === 'error'
      ? 'login-status-line login-status-line-error'
      : 'login-status-line'

    return (
      <div className={ className }>
        <span>{ loginStatus.message }</span>
        { logFileUrl
          ? <span> <a href={ logFileUrl } title={ loginStatus.logFilePath }>See log</a></span>
          : null
        }
      </div>
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
    const className = this.state.modalFlipping
      ? 'login-modal login-modal-flipping'
      : 'login-modal'

    return (
      <div className={ className }>
        <Modal.Dialog bsSize='small'>
          <Modal.Header>
            <Modal.Title className='login-modal-title' title={ t('login.title') }>{ t('login.title') }</Modal.Title>
            { this.renderHeaderActions() }
          </Modal.Header>
          <Modal.Body className='login-modal-body'>
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
    loginStatus: state.loginStatus,
    userSessionStatus: state.userSession.activeStatus
  }
}

export default connect(mapStateToProps)(LoginPage)
