'use strict'

import React, { Component } from 'react'
import './index.scss'

class NavigationPanel extends Component {

  renderTags() {
    let langTags = this.props.langTags
    let tagList = []
    for (let key in langTags) {
      if (langTags.hasOwnProperty(key)) {
        tagList.push(
          <div key={ key }> { key } </div>
        )
      }
    }

    return tagList
  } // renderTags()

  render() {
    return (
      <div className='menu-panel'>
          { this.renderTags() }
      </div>
    )
  }
}

export default NavigationPanel
