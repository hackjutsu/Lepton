'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import NavigationPanelDetails from '../navigationPanelDetails'
import NavigationPanel from '../navigationPanel'
import LoginPage from '../LoginPage'
import SnippetTable from '../snippetTable'
import './index.scss'

class AppContainer extends Component {

  render () {
    let {
        userSession,
        getLoggedInUserInfo,
        launchAuthWindow,
        updateLocalStorage,
        updateActiveGistAfterClicked,
        reSyncUserGists } = this.props

    if (userSession.activeStatus === 'ACTIVE') {
      return (
        <div className='app-container'>
          <NavigationPanel
            updateLocalStorage = { updateLocalStorage }
            updateActiveGistAfterClicked = { updateActiveGistAfterClicked }
            reSyncUserGists = { reSyncUserGists } />
          <NavigationPanelDetails />
          <SnippetTable
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
    userSession: state.userSession
  }
}

export default connect(mapStateToProps)(AppContainer)
