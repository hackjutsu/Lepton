'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import UserPanel from '../userPanel'
import { selectLangTag, selectGist, fetchSingleGist } from '../../actions/index'
import { bindActionCreators } from 'redux'

import {
  addLangPrefix as Prefixed,
  parseLangName as Resolved,
  addCustomTagsPrefix,
  parseCustomTags } from '../../utilities/parser'

import './index.scss'

class NavigationPanel extends Component {

  handleClicked (key) {
    this.props.selectLangTag(key)
    this.props.updateActiveGistAfterClicked(this.props.gists, this.props.gistTags, key)
  }

  renderLangTags () {
    let gistTags = this.props.gistTags
    let activeGistTag = this.props.activeGistTag
    let langTagList = []

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
    let gistTags = this.props.gistTags
    let activeGistTag = this.props.activeGistTag
    let customTagList = []

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
        <div className='lang-tag-section'>
          { this.renderLangTags() }
        </div>
        <hr/>
        <div className='custom-tag-section'>
          { this.renderCustomTags() }
        </div>
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
    selectLangTag: selectLangTag,
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanel)
