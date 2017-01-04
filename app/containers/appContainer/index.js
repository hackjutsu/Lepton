'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import UserPanel from '../userPanel'
import NavigationPanel from '../navigationPanel'
import NavigationPanelDetails from '../navigationPanelDetails'
import SnippetTable from '../snippetTable'
import './index.scss'

class AppContainer extends Component {

  render () {
    if (this.props.userSession.active === 'false') {
      return (
        <div className='app-container'>
          <UserPanel launchAuthWindow = { this.props.launchAuthWindow } />
        </div>
      )
    }

    return (
      <div className='app-container'>
        <UserPanel reSyncUserGists = { this.props.reSyncUserGists } />
        <NavigationPanel updateActiveGistAfterClicked = { this.props.updateActiveGistAfterClicked } />
        <NavigationPanelDetails />
        <SnippetTable />
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
