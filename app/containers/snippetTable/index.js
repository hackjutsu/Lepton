'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import Snippet from '../snippet'
import './index.scss'

class SnippetTable extends Component {

  render () {
    console.log('SnippetTable render is called')
    let gists = this.props.gists
    let activeGist = this.props.activeGist
    if (!gists || !activeGist) {
      return (
        <div className='snippet-table'></div>
      )
    } // This happens when the user has no gists

    return (
      <div className='snippet-table'>
          <Snippet snippet={ gists[activeGist] } />
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
