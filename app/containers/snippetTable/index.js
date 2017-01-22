'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Well } from 'react-bootstrap'
import Snippet from '../snippet'
import './index.scss'

class SnippetTable extends Component {

  render () {
    let { gists, activeGist, searchIndex, reSyncUserGists } = this.props
    if (!gists || !activeGist || !gists[activeGist]) {
      return (
        <div className='snippet-table'>
          <Well className='welcome-section'>Click <b>#new</b> on the left panel to create a gist.</Well>
        </div>
      )
    } // This happens when the user has no gists

    return (
      <div className='snippet-table'>
          <Snippet
            searchIndex = { searchIndex }
            reSyncUserGists={ reSyncUserGists }
            snippet={ gists[activeGist] } />
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    activeGist: state.activeGist,
    gists: state.gists
  }
}

export default connect(mapStateToProps)(SnippetTable)
