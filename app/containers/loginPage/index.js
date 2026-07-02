import { Alert, Button, Image, ProgressBar } from 'react-bootstrap'
import Avatar from 'boring-avatars'
import { connect } from 'react-redux'
import electronBridge from '../../utilities/electronBridge'
import LanguageSelector from '../languageSelector'
import Modal from '../compatModal'
import React, { Component } from 'react'
import { subscribeIpc, unsubscribeIpc } from '../../utilities/ipcSubscriptions'
import { getLocale, translate } from '../../utilities/i18n'

import dojocatImage from '../../utilities/octodex/dojocat.webp?inline'
import privateinvestocatImage from '../../utilities/octodex/privateinvestocat.webp?inline'
import saritocatImage from '../../utilities/octodex/saritocat.webp?inline'

import './index.scss'

const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

const LoginModeEnum = { CREDENTIALS: 1, TOKEN: 2 }
const LOGIN_MODAL_FLIP_DURATION_MS = 520

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
      activeLocale: getLocale(),
      loginMode: LoginModeEnum.CREDENTIALS,
      modalFlipping: false,
      pendingLoginMode: null,
      pendingLocale: null,
      pendingModalState: null
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

  startModalFlip (getFinalState) {
    if (this.state.modalFlipping) return Promise.resolve()

    clearTimeout(this.loginModeFlipTimer)

    return new Promise(resolve => {
      this.setState(prevState => {
        const finalState = typeof getFinalState === 'function' ? getFinalState(prevState) : {}
        const pendingLoginMode = Object.prototype.hasOwnProperty.call(finalState, 'loginMode')
          ? finalState.loginMode
          : prevState.loginMode
        const pendingLocale = Object.prototype.hasOwnProperty.call(finalState, 'activeLocale')
          ? finalState.activeLocale
          : prevState.activeLocale

        return {
          modalFlipping: true,
          pendingLoginMode,
          pendingLocale,
          pendingModalState: finalState
        }
      })

      this.loginModeFlipTimer = setTimeout(() => {
        this.setState(prevState => Object.assign(
          {},
          prevState.pendingModalState || {},
          {
            modalFlipping: false,
            pendingLoginMode: null,
            pendingLocale: null,
            pendingModalState: null
          }
        ), resolve)
      }, LOGIN_MODAL_FLIP_DURATION_MS)
    })
  }

  handleLoginModeSwitched (event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault()
    this.startModalFlip(prevState => ({
      loginMode: prevState.loginMode === LoginModeEnum.CREDENTIALS
        ? LoginModeEnum.TOKEN
        : LoginModeEnum.CREDENTIALS
    }))
  }

  translate (locale, key, values) {
    return translate(locale || this.state.activeLocale, key, values)
  }

  renderControlSection (loginMode = this.state.loginMode, locale = this.state.activeLocale, isInteractive = true) {
    const { authWindowStatus, loggedInUserInfo, userSessionStatus } = this.props
    const loggedInUserName = loggedInUserInfo ? loggedInUserInfo.profile : null
    const welcomeMessage = this.translate(locale, 'login.welcome')

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
              autoFocus={ isInteractive }
              className='modal-button'
              bsStyle="default"
              disabled={ !isInteractive }
              onClick={ this.handleContinueButtonClicked.bind(this, token) }>
              { loggedInUserName
                ? this.translate(locale, 'login.continueAs', { username: loggedInUserName })
                : this.translate(locale, 'login.happyCoding')
              }
            </Button>
            : this.renderTokenLoginSection(userSessionStatus, locale, isInteractive)}
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
            ? this.renderCredentialLoginSection(authWindowStatus, userSessionStatus, locale, isInteractive)
            : this.renderTokenLoginSection(userSessionStatus, locale, isInteractive)
          }
        </div>
      )
    }

    return null
  }

  renderLanguageSelector (locale = this.state.activeLocale, isInteractive = true) {
    return (
      <LanguageSelector
        className='login-language-selector'
        compact
        disabled={ !isInteractive }
        displayLocale={ locale }
        onBeforeChange={ this.handleLanguageChanging.bind(this) }
        onChangeComplete={ this.handleLanguageChangeComplete.bind(this) }
        onChangeFailed={ this.handleLanguageChangeFailed.bind(this) }
        selectedLocale={ locale }
      />
    )
  }

  handleLanguageChanging (locale) {
    return this.startModalFlip(() => ({
      activeLocale: locale
    }))
  }

  handleLanguageChangeComplete (locale) {
    this.setState({ activeLocale: locale })
  }

  handleLanguageChangeFailed () {
    clearTimeout(this.loginModeFlipTimer)
    this.setState({
      activeLocale: getLocale(),
      modalFlipping: false,
      pendingLoginMode: null,
      pendingLocale: null,
      pendingModalState: null
    })
  }

  updateInputValue (evt) {
    this.setState({
      inputTokenValue: evt.target.value
    })
  }

  renderCredentialLoginSection (authWindowStatus, userSessionStatus, locale = this.state.activeLocale, isInteractive = true) {
    return (
      <div>
        { userSessionStatus === 'EXPIRED'
          ? <Alert bsStyle="warning" className="login-alert">{ this.translate(locale, 'login.tokenInvalid') }</Alert>
          : null
        }
        <Button
          autoFocus={ isInteractive }
          className={ authWindowStatus === 'OFF' ? 'modal-button' : 'modal-button-disabled' }
          disabled={ !isInteractive }
          onClick={ this.handleLoginClicked.bind(this) }>
          { this.translate(locale, 'login.githubLogin') }
        </Button>
      </div>
    )
  }

  renderTokenLoginSection (userSessionStatus, locale = this.state.activeLocale, isInteractive = true) {
    return (
      <form>
        { userSessionStatus === 'EXPIRED'
          ? <Alert bsStyle="warning" className="login-alert">{ this.translate(locale, 'login.tokenInvalid') }</Alert>
          : null
        }
        <input
          className="form-control"
          placeholder={ this.translate(locale, 'login.tokenPlaceholder') }
          readOnly={ !isInteractive }
          tabIndex={ isInteractive ? undefined : -1 }
          value={ this.state.inputTokenValue }
          onChange={ this.updateInputValue.bind(this) }
        />
        <Button
          autoFocus={ isInteractive }
          className='modal-button'
          disabled={ !isInteractive }
          onClick={ this.handleTokenLoginButtonClicked.bind(this, this.state.inputTokenValue) }>
          { this.translate(locale, 'login.tokenLogin') }
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

  renderLoginModeSwitch (loginMode = this.state.loginMode, locale = this.state.activeLocale, isInteractive = true) {
    if (!this.shouldRenderLoginModeSwitch()) return null

    const label = loginMode === LoginModeEnum.CREDENTIALS
      ? this.translate(locale, 'login.switchToToken')
      : this.translate(locale, 'login.switchToCredentials')
    const icon = loginMode === LoginModeEnum.CREDENTIALS ? '🔑' : '👤'

    return (
      <button
        aria-label={ label }
        className='login-header-icon login-mode-switch'
        disabled={ !isInteractive }
        onClick={ this.handleLoginModeSwitched.bind(this) }
        title={ label }
        type='button'>
        <span aria-hidden='true'>{ icon }</span>
      </button>
    )
  }

  renderHeaderActions (loginMode = this.state.loginMode, locale = this.state.activeLocale, isInteractive = true) {
    return (
      <div className='login-header-actions'>
        { this.renderLoginModeSwitch(loginMode, locale, isInteractive) }
        { this.renderLanguageSelector(locale, isInteractive) }
      </div>
    )
  }

  renderLoginModalBody (loginMode = this.state.loginMode, locale = this.state.activeLocale, isInteractive = true) {
    return (
      <center className='login-modal-body-content'>
        { this.renderAvatar(loginMode) }
        { this.renderControlSection(loginMode, locale, isInteractive) }
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

  renderAvatar (loginMode = this.state.loginMode) {
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

  renderModalFace (loginMode, locale, className, isInteractive = true) {
    return (
      <div className={ className } aria-hidden={ isInteractive ? undefined : true }>
        <Modal.Header>
          <Modal.Title className='login-modal-title' title={ this.translate(locale, 'login.title') }>
            { this.translate(locale, 'login.title') }
          </Modal.Title>
          { this.renderHeaderActions(loginMode, locale, isInteractive) }
        </Modal.Header>
        <Modal.Body className='login-modal-body'>
          { this.renderLoginModalBody(loginMode, locale, isInteractive) }
        </Modal.Body>
      </div>
    )
  }

  render () {
    const { activeLocale, loginMode, modalFlipping, pendingLocale, pendingLoginMode } = this.state
    const className = modalFlipping
      ? 'login-modal login-modal-flipping'
      : 'login-modal'
    const backLoginMode = pendingLoginMode || loginMode
    const backLocale = pendingLocale || activeLocale

    return (
      <div className={ className }>
        <Modal.Dialog bsSize='small'>
          <div className='login-modal-card'>
            { this.renderModalFace(loginMode, activeLocale, 'login-modal-face login-modal-face-front', !modalFlipping) }
            { modalFlipping
              ? this.renderModalFace(backLoginMode, backLocale, 'login-modal-face login-modal-face-back', false)
              : null
            }
          </div>
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
