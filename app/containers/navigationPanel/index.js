'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { selectLangTag } from '../../actions/index'
import { bindActionCreators } from 'redux'
import './index.scss'

class NavigationPanel extends Component {

  renderTags () {
    let langTags = this.props.langTags
    let tagList = []
    for (let key in langTags) {
      if (langTags.hasOwnProperty(key)) {
        tagList.push(
          <div
            key={ key }
            onClick={() => this.props.selectLangTag(key)}>
            { key }
          </div>
        )
      }
    }

    return tagList
  } // renderTags()

  render () {
    return (
      <div className='menu-panel'>
          { this.renderTags() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    langTags: state.langTags
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({ selectLangTag: selectLangTag }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanel)
