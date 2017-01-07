'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { ListGroup, ListGroupItem } from 'react-bootstrap'
import { selectGist, fetchSingleGist } from '../../actions'
import './index.scss'

class NavigationPanelDetails extends Component {

  handleClicked (gistId) {
    console.log('NavigationPanelDetails.handleClicked is clicked with gistID ' + gistId)
    if (!this.props.gists[gistId].details) {
      this.props.fetchSingleGist(this.props.gists[gistId], gistId)
    }
    this.props.selectGist(gistId)
  }

  decideSnippetListItemClass (gistId) {
    if (gistId === this.props.activeGist) {
      if (this.props.gists[gistId].brief.public) {
        return 'active-snippet-thumnail-public'
      } else {
        return 'active-snippet-thumnail-private'
      }
    }
    return 'snippet-thumnail'
  }

  renderSnippetThumbnails () {
    let gists = this.props.gists
    let langTags = this.props.langTags
    let activeLangTag = this.props.activeLangTag
    let activeGist = this.props.activeGist

    let snippetThumbnails = []

    if (!gists || !langTags || !activeLangTag) {
      console.log('activeLangTag is ' + activeLangTag)
      console.log('activeGist is ' + activeGist)
      return (
        <div> You haven't created any gist yet. </div>
      )
    }

    for (let gistId of langTags[activeLangTag].keys()) {
      snippetThumbnails.push(
        <ListGroupItem className='snippet-thumnail-list-item' key={ gistId }>
          <div className={ this.decideSnippetListItemClass(gistId) }
              onClick={ this.handleClicked.bind(this, gistId) }>
              <div className='snippet-thumnail-description'>{ gists[gistId].brief.description }</div>
          </div>
        </ListGroupItem>
      )
    }

    return snippetThumbnails
  } // renderSnippetThumbnails()

  render () {
    return (
      <div className='panel-details'>
        <ListGroup>
          { this.renderSnippetThumbnails() }
        </ListGroup>
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
