'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import UserPanel from '../UserPanel'
import { selectLangTag, selectGist, fetchSingleGist } from '../../actions/index'
import { bindActionCreators } from 'redux'
import './index.scss'

class NavigationPanel extends Component {

  handleClicked (key) {
    this.props.selectLangTag(key)
    this.props.updateActiveGistAfterClicked(this.props.gists, this.props.langTags, key)
  }

  renderTags () {
    let langTags = this.props.langTags
    let activeLangTag = this.props.activeLangTag
    let tagList = []

    for (let lang in langTags) {
      if (langTags.hasOwnProperty(lang)) {
        tagList.push(
          <div key={ lang }>
            <a className={ lang === activeLangTag ? 'active-lang-tag' : 'lang-tag' }
              onClick={ this.handleClicked.bind(this, lang) }>
              { '#' + lang }
            </a>
          </div>
        )
      }
    }

    return tagList
  } // renderTags()

  renderTagSection () {
    if (this.props.userSession.active !== 'true') {
      return
    }

    return (
      <div className='lang-tag-section'>
        <hr/>
        { this.renderTags() }
      </div>
    )
  }

  render () {
    return (
      <div className='menu-panel'>
        <UserPanel
          reSyncUserGists = { this.props.reSyncUserGists }
          launchAuthWindow = { this.props.launchAuthWindow }
        />
        { this.renderTagSection() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    gists: state.gists,
    langTags: state.langTags,
    userSession: state.userSession,
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
