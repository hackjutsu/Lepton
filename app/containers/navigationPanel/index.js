'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import UserPanel from '../userPanel'
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

    Object.keys(langTags).sort().forEach(lang => {
      tagList.push(
        <div key={ lang }>
          <a className={ lang === activeLangTag ? 'active-lang-tag' : 'lang-tag' }
            onClick={ this.handleClicked.bind(this, lang) }>
            { '#' + lang }
          </a>
        </div>
      )
    })

    return tagList
  } // renderTags()

  renderTagSection () {
    if (this.props.userSession.activeStatus !== 'ACTIVE') {
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
    let {
      searchIndex,
      updateLocalStorage,
      getLoggedInUserInfo,
      reSyncUserGists,
      launchAuthWindow } = this.props

    return (
      <div className='menu-panel'>
        <UserPanel
          searchIndex = { searchIndex }
          updateLocalStorage = { updateLocalStorage }
          getLoggedInUserInfo = { getLoggedInUserInfo }
          reSyncUserGists = { reSyncUserGists }
          launchAuthWindow = { launchAuthWindow }
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
