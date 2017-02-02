'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { ListGroup, ListGroupItem } from 'react-bootstrap'
import { selectGist, fetchSingleGist } from '../../actions'
import { descriptionParser } from '../../utilities/parser'
import './index.scss'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

class NavigationPanelDetails extends Component {

  handleClicked (gistId) {
    let { gists, fetchSingleGist, selectGist } = this.props

    logger.info('A new gist is selected: ' + gistId)
    if (!gists[gistId].details) {
      logger.info('[Dispatch] fetchSingleGist ' + gistId)
      fetchSingleGist(gists[gistId], gistId)
    }
    logger.info('[Dispatch] selectGist ' + gistId)
    selectGist(gistId)
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

    let snippetThumbnails = []

    // When user has no gists, the default active language tag will be 'All' with
    // an empty array.
    if (!langTags || !langTags[activeLangTag] || langTags[activeLangTag].length === 0) {
      return (
        <div className='snippet-thumnail'></div>
      )
    }

    langTags[activeLangTag].forEach((gistId) => {
      // During the synchronization, gists will be updated before the langTags,
      // which introduces an interval where a gist exists in langTags but not in
      // the gists. This guard makes sure we push the gist only when it is already
      // available in gists.
      if (gists[gistId]) {
        // Pick up the content inside the first [] as the snippet thumbnail's title.
        // For example, "[Apple is delicious] It's affordable and healthy." will
        // pick up "Apple is delicious" as the title. If no brackets are found,
        // it shows to the original description. It provides users the flexibility
        // to decide what to be shown in the thumbnail.
        let gist = gists[gistId]
        let firstFilename = Object.keys(gist.brief.files)[0]
        let rawDescription = gist.brief.description.length === 0 ? firstFilename : gist.brief.description

        let { title, description } = descriptionParser(rawDescription)
        let thumbnailTitle = title.length > 0 ? title : description
        snippetThumbnails.push(
          <ListGroupItem className='snippet-thumnail-list-item' key={ gistId }>
            <div className={ this.decideSnippetListItemClass(gistId) }
                onClick={ this.handleClicked.bind(this, gistId) }>
                <div className='snippet-thumnail-description'>{ thumbnailTitle }</div>
            </div>
          </ListGroupItem>
        )
      }
    })

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
