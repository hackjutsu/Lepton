'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { selectLangTag, selectGist, fetchSingleGist } from '../../actions/index'
import { bindActionCreators } from 'redux'
import './index.scss'

class NavigationPanel extends Component {

  handleClicked (key) {
    this.props.selectLangTag(key)
    this.setDefaultGist(key)
  }

  setDefaultGist (key) {
    let gists = this.props.gists
    let langTags = this.props.langTags
    let activeLangTag = key
    if (!activeLangTag) return // This happens when the user has no gists

    // set the default gist
    let gistListForActiveLangTag = [...langTags[activeLangTag]]
    let defaultGistId = gistListForActiveLangTag[0]

    if (!gists[defaultGistId].details) {
      this.props.fetchSingleGist(gists[defaultGistId], defaultGistId)
    }
    this.props.selectGist(gistListForActiveLangTag[0])
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

  componentWillMount () {
    this.setDefaultGist(this.props.activeLangTag)
  }

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
