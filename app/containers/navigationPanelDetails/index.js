import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { descriptionParser } from '../../utilities/parser'
import electronBridge from '../../utilities/electronBridge'
import { getFilteredGistIds } from '../../utilities/gistFilters'
import { selectGist, fetchSingleGist, updatescrollRequestStatus } from '../../actions'
import React, { Component, PureComponent } from 'react'
import TagBadges from '../tagBadges'
import { t } from '../../utilities/i18n'
import {
  getRegularTagsForGist,
  shouldColorTags,
  shouldShowTagsInSnippetList
} from '../tagBadges/tags'
import { compareGists } from './sorting'

import './index.scss'

const logger = electronBridge.logger
const conf = electronBridge.config

class SnippetThumbnail extends PureComponent {
  constructor (props) {
    super(props)
    this.handleClick = () => this.props.onSelect(this.props.entry.id)
    this.setNode = node => this.props.onNode(this.props.entry.id, node)
  }

  render () {
    const { entry, active } = this.props
    const className = active
      ? (entry.isPublic ? 'active-snippet-thumnail-public' : 'active-snippet-thumnail-private')
      : 'snippet-thumnail'
    return (
      <li className='snippet-thumnail-list-item' ref={ this.setNode }>
        <div className={ className } onClick={ this.handleClick }>
          <div className='snippet-thumnail-description'>{ entry.title }</div>
          { entry.tags && <TagBadges tags={ entry.tags } className='snippet-thumnail-tags' colored={ entry.colored } /> }
        </div>
      </li>
    )
  }
}

class NavigationPanelDetails extends Component {
  constructor (props) {
    super(props)
    this.snippetNodes = {}
    this.handleClicked = this.handleClicked.bind(this)
    this.setSnippetNode = this.setSnippetNode.bind(this)
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

  getSnippetEntries () {
    const { gists, gistTags, activeGistFilters } = this.props
    // Settings reads use synchronous IPC. Read each once, not once per row.
    const sortingKey = conf.get('snippet:sorting')
    const sortingReverse = conf.get('snippet:sortingReverse')
    const showTags = shouldShowTagsInSnippetList(conf)
    const colored = showTags && shouldColorTags(conf)
    const inputs = [gists, gistTags, activeGistFilters, sortingKey, sortingReverse, showTags, colored]
    if (this.snippetEntries && inputs.every((value, index) => value === this.snippetEntries.inputs[index])) {
      return this.snippetEntries.entries
    }

    const entries = getFilteredGistIds(gistTags, activeGistFilters)
      .map(id => gists[id])
      // Sync can update gists before its tag index.
      .filter(Boolean)
      .sort(compareGists(sortingKey, sortingReverse))
      .map(gist => {
        const firstFilename = Object.keys(gist.brief.files)[0]
        const descriptionSource = gist.brief.providerTitle !== undefined
          ? gist.brief
          : gist.brief.description || firstFilename
        const { title, description, customTags } = descriptionParser(descriptionSource)
        const id = gist.brief.id
        return {
          id,
          title: title.length > 0 ? title : description,
          isPublic: gist.brief.public,
          tags: showTags ? getRegularTagsForGist(id, customTags, gistTags) : null,
          colored
        }
      })
    // Retain only the current list. Selection changes do not rebuild metadata.
    this.snippetEntries = { inputs, entries }
    return entries
  }

  renderSnippetThumbnails () {
    const entries = this.getSnippetEntries()
    if (!entries.length) {
      return (
        <li className='snippet-thumnail-list-item snippet-thumnail-empty' aria-live='polite' role='status'>
          <div className='snippet-thumnail'>{ t('search.noResults') }</div>
        </li>
      )
    }
    return entries.map(entry => (
      <SnippetThumbnail key={ entry.id } entry={ entry } active={ entry.id === this.props.activeGist }
        onSelect={ this.handleClicked } onNode={ this.setSnippetNode } />
    ))
  }

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
    activeGistFilters: state.activeGistFilters,
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
