'use strict'

import React, { Component } from 'react'
import './index.scss'

class NavigationPanelDetails extends Component {

  renderSnippetThumbnails() {
    let langTags = this.props.langTags
    let snippetThumbnails = []
    for (let item of langTags[this.props.activeTag].keys()) {
        snippetThumbnails.push(
            <div key={ item }> { item } </div>
        )
    }

    return snippetThumbnails
  } // renderTags()

  render() {
    return (
      <div className='panel-details'>
          { this.renderSnippetThumbnails() }
      </div>
    )
  }
}

export default NavigationPanelDetails
