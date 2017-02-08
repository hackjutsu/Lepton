'use strict'

import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import UserPanel from '../userPanel'
import { selectGistTag, selectGist, fetchSingleGist } from '../../actions/index'
import { parseLangName as Resolved } from '../../utilities/parser'

import './index.scss'

class NavigationPanel extends Component {

  handleClicked (key) {
    const { selectGistTag, updateActiveGistAfterClicked, gists, gistTags } = this.props
    selectGistTag(key)
    updateActiveGistAfterClicked(gists, gistTags, key)
  }

  renderLangTags () {
    const { gistTags, activeGistTag } = this.props
    const langTagList = []

    Object.keys(gistTags)
    .filter(tag => {
      return tag.startsWith('lang@')
    })
    .sort()
    .forEach(prefixedLang => {
      langTagList.push(
        <div key={ prefixedLang }>
          <a className={ prefixedLang === activeGistTag ? 'active-gist-tag' : 'gist-tag' }
            onClick={ this.handleClicked.bind(this, prefixedLang) }>
            { '#' + Resolved(prefixedLang) }
          </a>
        </div>
      )
    })

    return langTagList
  } // renderLangTags()

  renderCustomTags () {
    const { gistTags, activeGistTag } = this.props
    const customTagList = []

    Object.keys(gistTags)
    .filter(tag => {
      return !tag.startsWith('lang@')
    })
    .sort()
    .forEach(prefixedLang => {
      customTagList.push(
        <div key={ prefixedLang }>
          <a className={ prefixedLang === activeGistTag ? 'active-gist-tag' : 'gist-tag' }
            onClick={ this.handleClicked.bind(this, prefixedLang) }>
            { '#' + Resolved(prefixedLang) }
          </a>
        </div>
      )
    })

    return customTagList
  }

  renderTagSection () {
    if (this.props.userSession.activeStatus !== 'ACTIVE') {
      return
    }

    return (
      <div className='gist-tag-section'>
        <div className='lang-tag-section-scroll'>
          <div className='lang-tag-section-content'>
            { this.renderLangTags() }
          </div>
        </div>
        <hr/>
        <div className='custom-tag-section-scroll'>
          <div className='lang-tag-section-content'>
            { this.renderCustomTags() }
          </div>
        </div>
      </div>
    )
  }

  render () {
    const {
      searchIndex,
      updateLocalStorage,
      getLoggedInUserInfo,
      reSyncUserGists,
      launchAuthWindow } = this.props

    return (
      <div className='menu-panel'>
        <UserPanel
          className='user-panel'
          searchIndex = { searchIndex }
          updateLocalStorage = { updateLocalStorage }
          getLoggedInUserInfo = { getLoggedInUserInfo }
          reSyncUserGists = { reSyncUserGists }
          launchAuthWindow = { launchAuthWindow }
        />
        <hr/>
        { this.renderTagSection() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    gists: state.gists,
    gistTags: state.gistTags,
    userSession: state.userSession,
    activeGistTag: state.activeGistTag
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectGistTag: selectGistTag,
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanel)
