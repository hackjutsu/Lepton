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
    let tagList = []
    for (let key in langTags) {
      if (langTags.hasOwnProperty(key)) {
        tagList.push(
          <div className='lang-tag'
            key={ key }
            onClick={ () => this.handleClicked(key) }>
            { key }
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
