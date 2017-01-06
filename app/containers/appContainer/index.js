'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import NavigationPanelDetails from '../navigationPanelDetails'
import NavigationPanel from '../navigationPanel'
import SnippetTable from '../snippetTable'
import './index.scss'

class AppContainer extends Component {

  render () {
    if (this.props.userSession.active === 'false') {
      return (
        <div className='app-container'>
          <NavigationPanel
            launchAuthWindow = { this.props.launchAuthWindow }
            eSyncUserGists = { this.props.reSyncUserGists }
            />
        </div>
      )
    }

    return (
      <div className='app-container'>
        <NavigationPanel
          updateActiveGistAfterClicked = { this.props.updateActiveGistAfterClicked }
          reSyncUserGists = { this.props.reSyncUserGists } />
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
