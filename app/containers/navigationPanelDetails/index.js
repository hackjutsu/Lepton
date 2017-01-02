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
    let langTags = this.props.langTags
    let activeLangTag = this.props.activeLangTag

    let snippetThumbnails = []
    for (let item of langTags[activeLangTag].keys()) {
      snippetThumbnails.push(
        <div
          key={ item }
          onClick={ () => this.handleClicked(item) }>
          { item }
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
