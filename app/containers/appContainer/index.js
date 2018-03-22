'use strict'

import { shell } from 'electron'
import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Alert } from 'react-bootstrap'
import SplitPane from 'react-split-pane'
import electronLocalStorage from 'electron-json-storage-sync'
import NavigationPanelDetails from '../navigationPanelDetails'
import NavigationPanel from '../navigationPanel'
import LoginPage from '../loginPage'
import SnippetPanel from '../snippetPanel'
import SearchPage from '../searchPage'
import AboutPage from '../aboutPage'
import Dashboard from '../dashboard'
import { updateUpdateAvailableBarStatus } from '../../actions/index'

import './index.scss'

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
    return (
      <div>
        { searchWindowStatus === 'OFF'
          ? null
          : <SearchPage searchIndex = { searchIndex } /> }
      </div>
    )
  }

  dismissUpdateAlert () {
    const { updateUpdateAvailableBarStatus } = this.props
    updateUpdateAvailableBarStatus('OFF')
  }

  handleDownloadClicked () {
    const { newVersionInfo } = this.props
    shell.openExternal(newVersionInfo.url)
    this.dismissUpdateAlert()
  }

  handleReleaseNotesClicked () {
    shell.openExternal('https://github.com/hackjutsu/Lepton/releases')
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
      searchIndex } = this.props

    return (
      <div>
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
        <SplitPane split='vertical' minSize={180} maxSize={300} defaultSize={230}>
          <NavigationPanelDetails />
          <SnippetPanel
            searchIndex = { searchIndex }
            reSyncUserGists = { reSyncUserGists } />
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
