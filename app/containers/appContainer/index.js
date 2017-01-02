'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import NavigationPanel from '../navigationPanel'
import NavigationPanelDetails from '../navigationPanelDetails'
// import SnippetTable from '../snippetTable'
import './index.scss'

class AppContainer extends Component {

  render () {
    return (
      <div className='app-container'>
        <NavigationPanel />
        <NavigationPanelDetails />
        <SnippetTable />
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {}
}

export default connect(mapStateToProps)(AppContainer)
