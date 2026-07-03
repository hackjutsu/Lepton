import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { descriptionParser } from '../../utilities/parser'
import electronBridge from '../../utilities/electronBridge'
import { selectGist, fetchSingleGist, updatescrollRequestStatus } from '../../actions'
import React, { Component } from 'react'
import TagBadges from '../tagBadges'
import {
  getRegularTagsForGist,
  shouldColorTags,
  shouldShowTagsInSnippetList
} from '../tagBadges/tags'
import { compareGists } from './sorting'

import './index.scss'

const logger = electronBridge.logger
const conf = electronBridge.config

class NavigationPanelDetails extends Component {
  constructor (props) {
    super(props)
    this.snippetNodes = {}
  }

  componentDidUpdate () {
    const { updatescrollRequestStatus, scrollRequestStatus, activeGist } = this.props

    if (scrollRequestStatus === 'ON') {
      if (this.snippetNodes[activeGist]) {
        this.snippetNodes[activeGist].scrollIntoView(true)
      }

      logger.info('[Dispatch] update scroll request to OFF')
      updatescrollRequestStatus('OFF')
    }
  }

  setSnippetNode (gistId, node) {
    if (node) {
      this.snippetNodes[gistId] = node
    } else {
      delete this.snippetNodes[gistId]
    }
  }

  handleClicked (gistId) {
    const { gists, fetchSingleGist, selectGist } = this.props

    logger.info('A new snippet is selected: ' + gistId)
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

  renderSnippetTags (gistId, customTags) {
    if (!shouldShowTagsInSnippetList(conf)) {
      return null
    }

    const { gistTags } = this.props
    const tags = getRegularTagsForGist(gistId, customTags, gistTags)
    return (
      <TagBadges
        tags={ tags }
        className='snippet-thumnail-tags'
        colored={ shouldColorTags(conf) } />
    )
  }

  renderSnippetThumbnails () {
    const { gists, gistTags, activeGistTag } = this.props
    const snippetThumbnails = []

    // When user has no gists, the default active language tag will be 'All' with
    // an empty array.
    if (!gistTags || !gistTags[activeGistTag] || gistTags[activeGistTag].length === 0) {
      return (
        <div className='snippet-thumnail'></div>
      )
    }

    const rawGists = []
    gistTags[activeGistTag].forEach((gistId) => {
      // During the synchronization, gists will be updated before the gistTags,
      // which introduces an interval where a gist exists in gistTags but not in
      // the gists. This guard makes sure we push the gist only when it is already
      // available in gists.
      if (gists[gistId]) {
        // Pick up the content inside the first [] as the snippet thumbnail's title.
        // For example, "[Apple is delicious] It's affordable and healthy." will
        // pick up "Apple is delicious" as the title. If no brackets are found,
        // it shows to the original description. It provides users the flexibility
        // to decide what to be shown in the thumbnail.
        const gist = gists[gistId]
        rawGists.push(gist)
      }
    })

    const sortingKey = conf.get('snippet:sorting')
    const sortingReverse = conf.get('snippet:sortingReverse')
    rawGists.sort(compareGists(sortingKey, sortingReverse))

    rawGists.forEach((gist) => {
      const firstFilename = Object.keys(gist.brief.files)[0]
      // '' will be converted to false, so this statement can handle situations
      // for null, '' and undefined
      const rawDescription = gist.brief.description || firstFilename

      const { title, description, customTags } = descriptionParser(rawDescription)
      const thumbnailTitle = title.length > 0 ? title : description
      const gistId = gist.brief.id
      snippetThumbnails.push(
        <li
          className='snippet-thumnail-list-item'
          key={ gistId }
          ref={ node => this.setSnippetNode(gistId, node) }>
          <div className={ this.decideSnippetListItemClass(gistId) }
            onClick={ this.handleClicked.bind(this, gistId) }>
            <div className='snippet-thumnail-description'>{ thumbnailTitle }</div>
            { this.renderSnippetTags(gistId, customTags) }
          </div>
        </li>
      )
    })

    return snippetThumbnails
  } // renderSnippetThumbnails()

  render () {
    return (
      <div className='panel-thumbnails-background'>
        <div className='panel-thumbnails-scroll'>
          <div className='panel-thumbnails-content'>
            <ul>
              { this.renderSnippetThumbnails() }
            </ul>
          </div>
        </div>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    gists: state.gists,
    gistTags: state.gistTags,
    activeGistTag: state.activeGistTag,
    activeGist: state.activeGist,
    scrollRequestStatus: state.scrollRequestStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist,
    updatescrollRequestStatus: updatescrollRequestStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanelDetails)
