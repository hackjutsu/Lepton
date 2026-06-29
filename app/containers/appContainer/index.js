import { Alert } from 'react-bootstrap'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import electronBridge from '../../utilities/electronBridge'
import { updateUpdateAvailableBarStatus } from '../../actions/index'
import AboutPage from '../aboutPage'
import Dashboard from '../dashboard'
import electronLocalStorage from 'electron-json-storage-sync'
import LoginPage from '../loginPage'
import NavigationPanel from '../navigationPanel'
import NavigationPanelDetails from '../navigationPanelDetails'
import React, { Component } from 'react'
import SearchPage from '../searchPage'
import SnippetPanel from '../snippetPanel'
import { Pane, SplitPane } from 'react-split-pane'
import ThemeManager from '../../utilities/themeManager'

import './index.scss'
import './scrollbar.scss'

const conf = electronBridge.config
const themeManager = new ThemeManager()
themeManager.setTheme(conf.get('theme'))

function SplitPaneDivider (props) {
  const {
    className,
    currentSize,
    direction,
    disabled,
    index,
    isDragging,
    maxSize,
    minSize,
    onKeyDown,
    onMouseDown,
    onPointerDown,
    onTouchEnd,
    onTouchStart,
    style
  } = props
  const orientation = direction === 'horizontal' ? 'vertical' : 'horizontal'
  const dividerStyle = Object.assign({}, direction === 'horizontal'
    ? { width: '1px', cursor: disabled ? 'default' : 'col-resize' }
    : { height: '1px', cursor: disabled ? 'default' : 'row-resize' }, style)

  return (
    <div
      aria-label={ `${orientation} divider ${index + 1}` }
      aria-orientation={ orientation }
      aria-valuemax={ maxSize === Infinity ? undefined : maxSize }
      aria-valuemin={ minSize }
      aria-valuenow={ currentSize }
      className={ `split-pane-divider ${direction}${isDragging ? ' dragging' : ''}${className ? ` ${className}` : ''}` }
      data-divider-index={ index }
      onKeyDown={ disabled ? undefined : onKeyDown }
      onMouseDown={ disabled ? undefined : onMouseDown }
      onPointerDown={ disabled ? undefined : onPointerDown }
      onTouchEnd={ disabled ? undefined : onTouchEnd }
      onTouchStart={ disabled ? undefined : onTouchStart }
      role='separator'
      style={ dividerStyle }
      tabIndex={ disabled ? -1 : 0 } />
  )
}

class AppContainer extends Component {
  renderAboutPage () {
    const { updateAboutModalStatus } = this.props
    return (
      <AboutPage updateAboutModalStatus = { updateAboutModalStatus }/>
    )
  }

  renderDashboard () {
    const { updateDashboardStatus } = this.props
    return (
      <Dashboard updateDashboardStatus = { updateDashboardStatus }/>
    )
  }

  renderSearchPage () {
    const { searchWindowStatus, searchIndex } = this.props
    return searchWindowStatus === 'OFF'
      ? null
      : <SearchPage searchIndex = { searchIndex } />
  }

  dismissUpdateAlert () {
    const { updateUpdateAvailableBarStatus } = this.props
    updateUpdateAvailableBarStatus('OFF')
  }

  handleDownloadClicked () {
    const { newVersionInfo } = this.props
    electronBridge.shell.openExternal(newVersionInfo.url)
    this.dismissUpdateAlert()
  }

  handleReleaseNotesClicked () {
    electronBridge.shell.openExternal('https://github.com/hackjutsu/Lepton/releases')
    this.dismissUpdateAlert()
  }

  handleSkipClicked () {
    const { newVersionInfo } = this.props
    electronLocalStorage.set('skipped-version', newVersionInfo.version)
    this.dismissUpdateAlert()
  }

  renderUpdateAlert () {
    const { updateAvailableBarStatus, newVersionInfo } = this.props
    return (
      <div>
        { updateAvailableBarStatus === 'ON'
          ? <Alert bsStyle='warning' onDismiss={ this.dismissUpdateAlert.bind(this) }>
            { `New version ${newVersionInfo.version} is available!  ` }
            <a className='customized-button' onClick={ this.handleSkipClicked.bind(this) }>#skip</a>
            { newVersionInfo.url
              ? <a className='customized-button' onClick={ this.handleReleaseNotesClicked.bind(this) }>#release</a>
              : <a className='customized-button' onClick={ this.handleReleaseNotesClicked.bind(this) }>#download</a> }
            { newVersionInfo.url
              ? <a className='customized-button' onClick={ this.handleDownloadClicked.bind(this) }>#download</a>
              : null }
          </Alert>
          : null }
      </div>
    )
  }

  renderActiveNormalSection () {
    const {
      updateLocalStorage,
      updateActiveGistAfterClicked,
      reSyncUserGists,
      localPref,
      searchIndex
    } = this.props

    return (
      <div className='active-layout'>
        { this.renderAboutPage() }
        { this.renderDashboard() }
        { this.renderSearchPage() }
        { this.renderUpdateAlert() }
        <NavigationPanel
          localPref = { localPref }
          searchIndex = { searchIndex }
          updateLocalStorage = { updateLocalStorage }
          updateActiveGistAfterClicked = { updateActiveGistAfterClicked }
          reSyncUserGists = { reSyncUserGists } />
        <SplitPane className='content-split-pane' direction='horizontal' divider={ SplitPaneDivider } dividerClassName='minimal'>
          <Pane minSize={180} maxSize={300} defaultSize={230}>
            <NavigationPanelDetails />
          </Pane>
          <Pane>
            <SnippetPanel
              searchIndex = { searchIndex }
              reSyncUserGists = { reSyncUserGists } />
          </Pane>
        </SplitPane>
      </div>
    )
  }

  renderActiveImmersiveSection () {
    const { searchIndex, reSyncUserGists } = this.props
    return (
      <SnippetPanel
        searchIndex = { searchIndex }
        reSyncUserGists = { reSyncUserGists } />
    )
  }

  renderActiveSection () {
    const { immersiveMode } = this.props
    return (
      <div>
        { immersiveMode === 'ON'
          ? this.renderActiveImmersiveSection()
          : this.renderActiveNormalSection() }
      </div>
    )
  }

  renderInactiveSection () {
    const { loggedInUserInfo, launchAuthWindow } = this.props
    return (
      <LoginPage
        loggedInUserInfo = { loggedInUserInfo }
        launchAuthWindow = { launchAuthWindow } />
    )
  }

  render () {
    const { userSession } = this.props
    return (
      <div className='app-container'>
        { userSession.activeStatus === 'ACTIVE'
          ? this.renderActiveSection()
          : this.renderInactiveSection() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    userSession: state.userSession,
    searchWindowStatus: state.searchWindowStatus,
    aboutModalStatus: state.aboutModalStatus,
    dashboardModalStatus: state.dashboardModalStatus,
    newVersionInfo: state.newVersionInfo,
    updateAvailableBarStatus: state.updateAvailableBarStatus,
    immersiveMode: state.immersiveMode
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateUpdateAvailableBarStatus: updateUpdateAvailableBarStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(AppContainer)
