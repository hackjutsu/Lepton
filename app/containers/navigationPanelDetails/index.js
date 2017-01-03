'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { selectGist, fetchSingleGist } from '../../actions'
import './index.scss'

class NavigationPanelDetails extends Component {

  handleClicked (gistId) {
    if (!this.props.gists[gistId].details) {
      this.props.fetchSingleGist(this.props.gists[gistId], gistId)
    }
    this.props.selectGist(gistId)
  }

  renderSnippetThumbnails () {
    let gists = this.props.gists
    let langTags = this.props.langTags
    let activeLangTag = this.props.activeLangTag
    let activeGist = this.props.activeGist

    let snippetThumbnails = []

    if (!gists || !langTags || !activeLangTag || !activeGist) {
      return (
        <div> Loading... </div>
      )
    }

    for (let gistId of langTags[activeLangTag].keys()) {
      snippetThumbnails.push(
        <div className={ gistId === activeGist ? 'active-snippet-thumnail' : 'snippet-thumnail' }
          key={ gistId }
          onClick={ () => this.handleClicked(gistId) }>
          { gists[gistId].brief.description }
        </div>
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
  return {
    gists: state.gists,
    langTags: state.langTags,
    activeLangTag: state.activeLangTag,
    activeGist: state.activeGist
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanelDetails)
