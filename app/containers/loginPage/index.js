import { Button, Image, ProgressBar } from 'react-bootstrap'
import Avatar from 'boring-avatars'
import { connect } from 'react-redux'
import electronBridge from '../../utilities/electronBridge'
import LanguageSelector from '../languageSelector'
import Modal from '../compatModal'
import React, { Component } from 'react'
import { subscribeIpc, unsubscribeIpc } from '../../utilities/ipcSubscriptions'
import { getLocale, translate } from '../../utilities/i18n'
import {
  getProviderStorageKey,
  normalizeProviderConfig
} from '../../utilities/snippetProvider'

import dojocatImage from '../../utilities/octodex/dojocat.webp?inline'
import privateinvestocatImage from '../../utilities/octodex/privateinvestocat.webp?inline'
import saritocatImage from '../../utilities/octodex/saritocat.webp?inline'

import './index.scss'

const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

const LoginModeEnum = { CREDENTIALS: 1, TOKEN: 2 }
const ProviderTypeEnum = { GITHUB: 'github', GITLAB: 'gitlab' }
const LOGIN_MODAL_FLIP_DURATION_MS = 520

function getFileUrl (filePath) {
  if (!filePath) return null
  const normalizedPath = String(filePath).replace(/\\/g, '/')
  const fileUrlPrefix = normalizedPath[0] === '/' ? 'file://' : 'file:///'
  return fileUrlPrefix + encodeURI(normalizedPath)
}

function normalizeProviderType (value) {
  const providerType = typeof value === 'string' ? value : value && value.type
  return providerType === ProviderTypeEnum.GITLAB
    ? ProviderTypeEnum.GITLAB
    : ProviderTypeEnum.GITHUB
}

function getProviderHost (provider) {
  if (!provider || typeof provider === 'string') return null

  try {
    return normalizeProviderConfig(provider).baseUrl
  } catch {
    const rawHost = provider.baseUrl !== undefined ? provider.baseUrl : provider.host
    return rawHost === undefined || rawHost === null ? null : String(rawHost)
  }
}

function getSavedGitLabHost (provider, providerType) {
  const providerHost = providerType === ProviderTypeEnum.GITLAB
    ? getProviderHost(provider)
    : null
  if (providerHost !== null) return providerHost

  const configuredHost = conf.get('gitlab:host')
  return configuredHost === undefined || configuredHost === null
    ? 'gitlab.com'
    : String(configuredHost)
}

function getCachedProviderType (loggedInUserInfo) {
  if (!loggedInUserInfo) return null
  if (loggedInUserInfo.providerType) return normalizeProviderType(loggedInUserInfo.providerType)
  if (loggedInUserInfo.provider) return normalizeProviderType(loggedInUserInfo.provider)
  return ProviderTypeEnum.GITHUB
}

function getCachedProviderIdentity (loggedInUserInfo) {
  if (!loggedInUserInfo) return null

  let provider = null
  if (loggedInUserInfo.provider && typeof loggedInUserInfo.provider === 'object') {
    provider = loggedInUserInfo.provider
  } else if (loggedInUserInfo.providerBaseUrl) {
    provider = {
      type: getCachedProviderType(loggedInUserInfo),
      baseUrl: loggedInUserInfo.providerBaseUrl
    }
  }

  if (!provider) return null

  try {
    return getProviderStorageKey(provider)
  } catch {
    return null
  }
}

function hasSameCachedCredential (previousUserInfo, currentUserInfo) {
  if (!previousUserInfo || !currentUserInfo) return false

  const previousProviderIdentity = getCachedProviderIdentity(previousUserInfo) ||
    getCachedProviderType(previousUserInfo)
  const currentProviderIdentity = getCachedProviderIdentity(currentUserInfo) ||
    getCachedProviderType(currentUserInfo)
  return previousProviderIdentity === currentProviderIdentity &&
    previousUserInfo.token === currentUserInfo.token
}

export class LoginPage extends Component {
  constructor (props) {
    super(props)
    const activeLocale = getLocale()
    const providerType = normalizeProviderType(props.provider || conf.get('provider:type'))
    const gitlabHost = getSavedGitLabHost(props.provider, providerType)
    let providerSaveError = ''
    if (providerType === ProviderTypeEnum.GITLAB) {
      try {
        normalizeProviderConfig({ type: ProviderTypeEnum.GITLAB, baseUrl: gitlabHost })
      } catch {
        providerSaveError = translate(
          activeLocale,
          gitlabHost.trim() ? 'login.gitlabHostInvalid' : 'login.gitlabHostRequired'
        )
      }
    }
    this.ignoredCachedProviderTypes = new Set()
    this.persistedGitLabHost = gitlabHost
    this.state = {
      inputTokenValue: '',
      activeLocale,
      loginMode: LoginModeEnum.CREDENTIALS,
      providerType,
      providerSaving: false,
      providerSaveError,
      gitlabHost,
      gitlabHostSaving: false,
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
      const currentUserInfo = this.props.loggedInUserInfo
      logger.debug('-----> Received "auto-login" signal with loggedInUserInfo ' + JSON.stringify(currentUserInfo))
      if (this.isCachedCredentialForSelectedProvider(currentUserInfo) && currentUserInfo.token) {
        this.handleContinueButtonClicked(currentUserInfo.token)
      }
    })

    logger.debug('-----> sending login-page-ready signal')
    ipcRenderer.send('login-page-ready')
  }

  componentDidUpdate (prevProps) {
    const previousProviderType = normalizeProviderType(prevProps.provider || this.state.providerType)
    const providerType = normalizeProviderType(this.props.provider || this.state.providerType)
    const previousProviderHost = getProviderHost(prevProps.provider)
    const providerHost = getProviderHost(this.props.provider)

    if (previousProviderType !== providerType && this.state.providerType !== providerType) {
      this.setState({ inputTokenValue: '', providerType })
    }
    if (previousProviderHost !== providerHost && providerHost && this.state.gitlabHost !== providerHost) {
      this.persistedGitLabHost = providerHost
      this.setState({ gitlabHost: providerHost })
    }
    if (this.props.loggedInUserInfo &&
      !hasSameCachedCredential(prevProps.loggedInUserInfo, this.props.loggedInUserInfo)) {
      this.ignoredCachedProviderTypes.delete(getCachedProviderType(this.props.loggedInUserInfo))
    }

    if (prevProps.userSessionStatus === 'IN_PROGRESS' &&
      this.props.userSessionStatus === 'INACTIVE') {
      this.ignoredCachedProviderTypes.add(this.state.providerType)
      clearTimeout(this.loginModeFlipTimer)
      this.setState({
        inputTokenValue: '',
        loginMode: LoginModeEnum.CREDENTIALS,
        modalFlipping: false,
        pendingLoginMode: null,
        pendingLocale: null,
        pendingModalState: null
      })
    }
  }

  componentWillUnmount () {
    logger.debug('-----> Removing listener for auto-login signal')
    unsubscribeIpc(this.ipcSubscriptions)
    clearTimeout(this.loginModeFlipTimer)
  }

  handleLoginClicked () {
    if (!this.state.providerSaving && this.props.authWindowStatus === 'OFF') {
      this.props.launchAuthWindow()
    }
  }

  handleContinueButtonClicked (token) {
    this.handleTokenLoginButtonClicked(token)
  }

  handleTokenLoginButtonClicked (token) {
    if (token && !this.state.providerSaving && this.props.authWindowStatus === 'OFF') {
      const prepareProvider = this.state.providerType === ProviderTypeEnum.GITLAB
        ? this.persistGitLabHost()
        : Promise.resolve(true)

      prepareProvider.then(isReady => {
        if (isReady && this.props.authWindowStatus === 'OFF') {
          this.props.launchAuthWindow(token)
        }
      })
    }
  }

  isCachedCredentialForSelectedProvider (loggedInUserInfo = this.props.loggedInUserInfo) {
    if (!loggedInUserInfo ||
      this.ignoredCachedProviderTypes.has(this.state.providerType) ||
      getCachedProviderType(loggedInUserInfo) !== this.state.providerType) {
      return false
    }

    const cachedProviderIdentity = getCachedProviderIdentity(loggedInUserInfo)
    if (!cachedProviderIdentity) {
      return this.state.providerType === ProviderTypeEnum.GITHUB
    }

    try {
      const propProviderType = normalizeProviderType(this.props.provider)
      const selectedProvider = this.state.providerType === ProviderTypeEnum.GITLAB
        ? { type: ProviderTypeEnum.GITLAB, baseUrl: this.state.gitlabHost }
        : propProviderType === ProviderTypeEnum.GITHUB
          ? this.props.provider
          : { type: ProviderTypeEnum.GITHUB }
      return cachedProviderIdentity === getProviderStorageKey(selectedProvider)
    } catch {
      return false
    }
  }

  handleProviderChanged (event) {
    const providerType = normalizeProviderType(event.target.value)
    const previousProviderType = this.state.providerType
    const saveSequence = (this.providerSaveSequence || 0) + 1
    this.providerSaveSequence = saveSequence
    let providerConfigurationError = ''
    if (providerType === ProviderTypeEnum.GITLAB) {
      try {
        normalizeProviderConfig({ type: providerType, baseUrl: this.state.gitlabHost })
      } catch {
        providerConfigurationError = this.translate(
          this.state.activeLocale,
          this.state.gitlabHost.trim() ? 'login.gitlabHostInvalid' : 'login.gitlabHostRequired'
        )
      }
    }

    this.setState({
      inputTokenValue: '',
      loginMode: providerType === ProviderTypeEnum.GITLAB
        ? LoginModeEnum.TOKEN
        : LoginModeEnum.CREDENTIALS,
      providerSaveError: '',
      providerSaving: true,
      providerType
    })

    return Promise.resolve(conf.set('provider:type', providerType))
      .then(persistedProviderType => {
        if (persistedProviderType !== providerType) throw new Error('Provider setting was rejected')
        if (providerConfigurationError) {
          if (this.providerSaveSequence === saveSequence) {
            this.setState({
              providerSaveError: providerConfigurationError,
              providerSaving: false
            })
          }
          return
        }
        if (this.props.onProviderChange) return this.props.onProviderChange(providerType)
      })
      .then(() => {
        if (this.providerSaveSequence === saveSequence) this.setState({ providerSaving: false })
      })
      .catch(error => {
        logger.error('Failed to update snippet provider', error)
        if (this.providerSaveSequence !== saveSequence) return

        let rollbackPersisted = false
        return Promise.resolve(conf.set('provider:type', previousProviderType))
          .then(persistedProviderType => {
            rollbackPersisted = persistedProviderType === previousProviderType
            if (!rollbackPersisted) throw new Error('Provider rollback was rejected')
            if (this.props.onProviderChange) return this.props.onProviderChange(previousProviderType)
          })
          .catch(rollbackError => {
            logger.error('Failed to roll back snippet provider', rollbackError)
          })
          .then(() => {
            if (this.providerSaveSequence !== saveSequence) return
            this.setState({
              providerSaveError: this.translate(this.state.activeLocale, 'login.providerSaveFailed'),
              providerSaving: false,
              providerType: rollbackPersisted ? previousProviderType : providerType
            })
          })
      })
  }

  handleGitLabHostChanged (event) {
    this.setState({ gitlabHost: event.target.value, providerSaveError: '' })
  }

  handleGitLabHostKeyDown (event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    event.currentTarget.blur()
  }

  persistGitLabHost (host = this.state.gitlabHost) {
    const enteredHost = String(host || '').trim()
    if (!enteredHost) {
      this.setState({
        providerSaveError: this.translate(this.state.activeLocale, 'login.gitlabHostRequired')
      })
      return Promise.resolve(false)
    }
    let gitlabHost
    try {
      gitlabHost = normalizeProviderConfig({
        type: ProviderTypeEnum.GITLAB,
        baseUrl: enteredHost
      }).baseUrl
    } catch {
      this.setState({
        providerSaveError: this.translate(this.state.activeLocale, 'login.gitlabHostInvalid')
      })
      return Promise.resolve(false)
    }
    if (gitlabHost === this.persistedGitLabHost) return Promise.resolve(true)
    if (this.pendingGitLabHostSave && this.pendingGitLabHostSave.host === gitlabHost) {
      return this.pendingGitLabHostSave.promise
    }

    const saveSequence = (this.gitLabHostSaveSequence || 0) + 1
    this.gitLabHostSaveSequence = saveSequence
    this.setState({ gitlabHost, gitlabHostSaving: true, providerSaveError: '' })

    const savePromise = Promise.resolve(conf.set('gitlab:host', gitlabHost))
      .then(persistedHost => {
        if (persistedHost !== gitlabHost) throw new Error('GitLab host setting was rejected')
        if (this.props.onGitLabHostChange) return this.props.onGitLabHostChange(gitlabHost)
      })
      .then(() => {
        if (this.gitLabHostSaveSequence === saveSequence) {
          this.persistedGitLabHost = gitlabHost
          this.setState({ gitlabHost, gitlabHostSaving: false })
        }
        return true
      })
      .catch(error => {
        logger.error('Failed to update GitLab instance host', error)
        if (this.gitLabHostSaveSequence === saveSequence) {
          this.setState({
            providerSaveError: this.translate(this.state.activeLocale, 'login.gitlabHostSaveFailed'),
            gitlabHostSaving: false
          })
        }
        return false
      })
    const pendingPromise = savePromise.finally(() => {
      if (this.pendingGitLabHostSave && this.pendingGitLabHostSave.promise === pendingPromise) {
        this.pendingGitLabHostSave = null
      }
    })
    this.pendingGitLabHostSave = { host: gitlabHost, promise: pendingPromise }
    return pendingPromise
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
    const matchingUserInfo = this.isCachedCredentialForSelectedProvider(loggedInUserInfo)
      ? loggedInUserInfo
      : null
    const loggedInUserName = matchingUserInfo ? matchingUserInfo.profile : null
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

    if (this.state.providerType === ProviderTypeEnum.GITLAB) {
      const token = matchingUserInfo ? matchingUserInfo.token : null
      return (
        <div className='button-group-modal'>
          <div className="login-page-text-link">
            <a href="https://github.com/hackjutsu/Lepton">{ welcomeMessage }</a>
          </div>
          { this.renderProviderControls(isInteractive) }
          { token
            ? <Button
              autoFocus={ isInteractive }
              className='modal-button'
              disabled={ !isInteractive || this.state.providerSaving }
              onClick={ this.handleContinueButtonClicked.bind(this, token) }>
              { loggedInUserName
                ? this.translate(locale, 'login.continueAs', { username: loggedInUserName })
                : this.translate(locale, 'login.happyCoding')
              }
            </Button>
            : this.renderTokenLoginSection(locale, isInteractive, ProviderTypeEnum.GITLAB) }
        </div>
      )
    }

    if (conf.get('enterprise:enable')) {
      const token = matchingUserInfo ? matchingUserInfo.token : null
      return (
        <div className='button-group-modal'>
          <div className="login-page-text-link">
            <a href="https://github.com/hackjutsu/Lepton">{ welcomeMessage }</a>
          </div>
          { this.renderProviderControls(isInteractive) }
          { token
            ? <Button
              autoFocus={ isInteractive }
              className='modal-button'
              bsStyle="default"
              disabled={ !isInteractive || this.state.providerSaving }
              onClick={ this.handleContinueButtonClicked.bind(this, token) }>
              { loggedInUserName
                ? this.translate(locale, 'login.continueAs', { username: loggedInUserName })
                : this.translate(locale, 'login.happyCoding')
              }
            </Button>
            : this.renderTokenLoginSection(locale, isInteractive)}
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
          { this.renderProviderControls(isInteractive) }
          { loginMode === LoginModeEnum.CREDENTIALS
            ? this.renderCredentialLoginSection(authWindowStatus, locale, isInteractive)
            : this.renderTokenLoginSection(locale, isInteractive)
          }
        </div>
      )
    }

    return null
  }

  renderLanguageSelector (locale = this.state.activeLocale, isInteractive = true) {
    return (
      <LanguageSelector
        className='login-language-selector login-header-tooltip'
        compact
        disabled={ !isInteractive || this.state.providerSaving }
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

  handleTokenLoginSubmitted (event) {
    event.preventDefault()
    this.handleTokenLoginButtonClicked(this.state.inputTokenValue)
  }

  renderProviderControls (isInteractive = true) {
    const isGitLab = this.state.providerType === ProviderTypeEnum.GITLAB
    const sessionBusy = this.props.authWindowStatus !== 'OFF' || this.props.userSessionStatus === 'IN_PROGRESS'
    const disabled = !isInteractive || this.state.providerSaving || sessionBusy

    return (
      <div className='login-provider-controls'>
        <label className='login-provider-field'>
          <span>{ this.translate(this.state.activeLocale, 'login.providerLabel') }</span>
          <select
            aria-label='Snippet provider'
            className='form-control'
            disabled={ disabled }
            tabIndex={ disabled ? -1 : undefined }
            value={ this.state.providerType }
            onChange={ this.handleProviderChanged.bind(this) }>
            <option value={ ProviderTypeEnum.GITHUB }>GitHub</option>
            <option value={ ProviderTypeEnum.GITLAB }>GitLab</option>
          </select>
        </label>
        { isGitLab
          ? <label className='login-provider-field'>
            <span>{ this.translate(this.state.activeLocale, 'login.instanceLabel') }</span>
            <input
              aria-label='GitLab instance host'
              autoComplete='url'
              className='form-control'
              disabled={ disabled || this.state.gitlabHostSaving }
              placeholder='gitlab.com'
              value={ this.state.gitlabHost }
              onBlur={ event => this.persistGitLabHost(event.currentTarget.value) }
              onChange={ this.handleGitLabHostChanged.bind(this) }
              onKeyDown={ this.handleGitLabHostKeyDown.bind(this) }
            />
          </label>
          : null }
        { this.state.providerSaveError
          ? <div className='login-provider-error' role='alert'>{ this.state.providerSaveError }</div>
          : null }
      </div>
    )
  }

  renderCredentialLoginSection (authWindowStatus, locale = this.state.activeLocale, isInteractive = true) {
    return (
      <div>
        <Button
          autoFocus={ isInteractive }
          className={ authWindowStatus === 'OFF' && !this.state.providerSaving ? 'modal-button' : 'modal-button-disabled' }
          disabled={ !isInteractive || this.state.providerSaving }
          onClick={ this.handleLoginClicked.bind(this) }>
          { this.translate(locale, 'login.githubLogin') }
        </Button>
      </div>
    )
  }

  renderTokenLoginSection (locale = this.state.activeLocale, isInteractive = true, providerType = ProviderTypeEnum.GITHUB) {
    const isGitLab = providerType === ProviderTypeEnum.GITLAB
    return (
      <form onSubmit={ this.handleTokenLoginSubmitted.bind(this) }>
        <input
          className="form-control"
          aria-label={ isGitLab ? 'GitLab personal access token' : undefined }
          autoComplete='current-password'
          placeholder={ isGitLab
            ? this.translate(locale, 'login.gitlabTokenPlaceholder')
            : this.translate(locale, 'login.tokenPlaceholder') }
          readOnly={ !isInteractive || this.state.providerSaving }
          tabIndex={ isInteractive && !this.state.providerSaving ? undefined : -1 }
          type={ isGitLab ? 'password' : 'text' }
          value={ this.state.inputTokenValue }
          onChange={ this.updateInputValue.bind(this) }
        />
        <Button
          autoFocus={ isInteractive }
          className='modal-button'
          disabled={ !isInteractive || this.state.providerSaving }
          type='submit'>
          { isGitLab
            ? this.translate(locale, 'login.gitlabTokenLogin')
            : this.translate(locale, 'login.tokenLogin') }
        </Button>
      </form>
    )
  }

  shouldRenderLoginModeSwitch () {
    const { loggedInUserInfo, userSessionStatus } = this.props
    const loggedInUserName = loggedInUserInfo ? loggedInUserInfo.profile : null

    return this.state.providerType === ProviderTypeEnum.GITHUB &&
      !conf.get('enterprise:enable') &&
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
        className='login-header-icon login-mode-switch login-header-tooltip'
        data-tooltip={ label }
        disabled={ !isInteractive || this.state.providerSaving }
        onClick={ this.handleLoginModeSwitched.bind(this) }
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
    const { authWindowStatus, loginStatus, userSessionStatus } = this.props
    if (!loginStatus || !loginStatus.message) return null

    const isIdleLoggedOut = userSessionStatus === 'INACTIVE' && authWindowStatus === 'OFF'
    if (isIdleLoggedOut && loginStatus.level !== 'error') return null

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
    const isGitLab = this.state.providerType === ProviderTypeEnum.GITLAB
    if (conf.get('avatar:type') === 'boring') {
      return <a href="https://github.com/hackjutsu/Lepton">
        <Avatar
          size={ isGitLab ? 160 : 200 }
          name={ Math.random().toString(36).substr(2, 5) }
          square={ false }
          variant={ conf.get('avatar:boringAvatarVariant') }
          colors={ ['#4D3B36', '#EB613B', '#F98F6F', '#C1D9CD', '#F7EADC'] }
        />
      </a>
    } else {
      let profileImage = dojocatImage
      if (!isGitLab && conf.get('enterprise:enable')) {
        profileImage = conf.get('enterprise:avatarUrl')
          ? conf.get('enterprise:avatarUrl')
          : privateinvestocatImage
      } else if (isGitLab || loginMode === LoginModeEnum.TOKEN) {
        profileImage = saritocatImage
      }

      return <a href="https://github.com/hackjutsu/Lepton">
        <Image className={ isGitLab ? 'profile-image-modal profile-image-modal-compact' : 'profile-image-modal' } src={ profileImage } rounded/>
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
      ? `login-modal login-modal-${this.state.providerType} login-modal-flipping`
      : `login-modal login-modal-${this.state.providerType}`
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
