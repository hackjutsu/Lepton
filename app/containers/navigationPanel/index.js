'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { selectLangTag, selectGist, fetchSingleGist } from '../../actions/index'
import { bindActionCreators } from 'redux'
import './index.scss'

class NavigationPanel extends Component {

  handleClicked (key) {
    this.props.selectLangTag(key)
    this.props.setActiveGistAfterClicked(this.props.gists, this.props.langTags, key)
  }

  renderTags () {
    let langTags = this.props.langTags
    let activeLangTag = this.props.activeLangTag
    let tagList = []
    for (let lang in langTags) {
      if (langTags.hasOwnProperty(lang)) {
        tagList.push(
          <div className={ lang === activeLangTag ? 'active-lang-tag' : 'lang-tag' }
            key={ lang }
            onClick={ () => this.handleClicked(lang) }>
            { lang }
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
    gists: state.gists,
    langTags: state.langTags,
    activeLangTag: state.activeLangTag
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectLangTag: selectLangTag,
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanel)
