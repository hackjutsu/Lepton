'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { selectGist, fetchSingleGist } from '../../actions'
import './index.scss'

class NavigationPanelDetails extends Component {

  renderSnippetThumbnails () {
    let gists = this.props.gists
    let langTags = this.props.langTags
    let activeLangTag = this.props.activeLangTag

    // set the default gist
    let gistListForActiveLangTag = [...langTags[activeLangTag]]
    let defaultGistId = gistListForActiveLangTag[0]

    console.log(defaultGistId)

    if (!gists[defaultGistId].details) {
      this.props.fetchSingleGist(gists[defaultGistId], defaultGistId)
    }
    this.props.selectGist(gistListForActiveLangTag[0])

    let snippetThumbnails = []
    for (let item of langTags[activeLangTag].keys()) {
      snippetThumbnails.push(
            <div key={ item }> { item } </div>
      )
    }

    return snippetThumbnails
  } // renderTags()

  render () {
    return (
      <div className='panel-details'>
          { this.renderSnippetThumbnails() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  console.log('** Inside NavigationPanelDetails')
  return {
    gists: state.gists,
    langTags: state.langTags,
    activeLangTag: state.activeLangTag
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanelDetails)
