'use strict'

import React, { Component } from 'react'
import { shell } from 'electron'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Alert } from 'react-bootstrap'
import NavigationPanelDetails from '../navigationPanelDetails'
import NavigationPanel from '../navigationPanel'
import LoginPage from '../loginPage'
import SnippetTable from '../snippetTable'
import SearchPage from '../searchPage'
import './index.scss'

import { updateUpdateAvailableBarStatus } from '../../actions/index'

class AppContainer extends Component {

  renderSearchPage () {
    if (this.props.searchWindowStatus === 'OFF') return null
    return (
      <SearchPage searchIndex = { this.props.searchIndex } />
    )
  }

  dismissAlert () {
    this.props.updateUpdateAvailableBarStatus('OFF')
  }

  handleDownloadClicked () {
    shell.openExternal(this.props.newVersionInfo.url)
    this.dismissAlert()
  }

  handleReleaseNotesClicked () {
    shell.openExternal('https://github.com/hackjutsu/Lepton/releases')
    this.dismissAlert()
  }

  handleSkipClicked () {
    localStorage.setItem('skipped-version', this.props.newVersionInfo.version)
    this.dismissAlert()
  }

  render () {
    let {
        userSession,
        getLoggedInUserInfo,
        launchAuthWindow,
        updateLocalStorage,
        updateActiveGistAfterClicked,
        reSyncUserGists,
        searchWindowStatus,
        updateAvailableBarStatus,
        searchIndex,
        newVersionInfo } = this.props

    if (userSession.activeStatus === 'ACTIVE') {
      return (
        <div className='app-container'>
          { this.renderSearchPage() }
          { updateAvailableBarStatus === 'ON'
              ? <Alert bsStyle="warning" onDismiss={ this.dismissAlert.bind(this) }>
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
          <NavigationPanel
            searchIndex = { searchIndex }
            updateLocalStorage = { updateLocalStorage }
            updateActiveGistAfterClicked = { updateActiveGistAfterClicked }
            reSyncUserGists = { reSyncUserGists } />
          <NavigationPanelDetails />
          <SnippetTable
            searchIndex = { searchIndex }
            reSyncUserGists = { reSyncUserGists } />
        </div>
      )
    }

    return (
      <div className='app-container'>
        <LoginPage
          getLoggedInUserInfo = { getLoggedInUserInfo }
          launchAuthWindow = { launchAuthWindow }/>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    userSession: state.userSession,
    searchWindowStatus: state.searchWindowStatus,
    newVersionInfo: state.newVersionInfo,
    updateAvailableBarStatus: state.updateAvailableBarStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateUpdateAvailableBarStatus: updateUpdateAvailableBarStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(AppContainer)
