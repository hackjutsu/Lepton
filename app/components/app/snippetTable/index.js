'use strict'

import React, { Component } from 'react'
import Snippet from '../snippet/index'
import './index.scss'

class SnippetTable extends Component {

  renderSnippets () {
    let gistStore = this.props.gistStore
    // let updateGistStore = this.props.updateGistStore
    let snippetList = []

    for (let key in gistStore) {
      if (gistStore.hasOwnProperty(key)) {
        snippetList.push(
          <Snippet snippet={ gistStore[key] } key={ key } />
        )
      }
    }

    return snippetList
  }

  render () {
    return (
      <div className='snippet-table'>
          { this.renderSnippets() }
      </div>
    )
  }
}

export default SnippetTable
