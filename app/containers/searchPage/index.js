import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import electronBridge from '../../utilities/electronBridge'
import Modal from '../compatModal'
import React, { Component } from 'react'
import { t } from '../../utilities/i18n'
import { formatRelativeTime } from '../../utilities/relativeTime'
import {
  addLangPrefix as Prefixed,
  descriptionParser,
} from '../../utilities/parser'
import {
  fetchSingleGist,
  selectGist,
  selectGistTag,
  updatescrollRequestStatus,
  updateSearchWindowStatus,
} from '../../actions'

import './index.scss'

const logger = electronBridge.logger

class SearchPage extends Component {
  constructor (props) {
    super(props)
    const initialSearchQuery = props.initialSearchQuery || ''
    this.state = {
      inputValue: initialSearchQuery,
      selectedIndex: 0,
      searchResults: []
    }
    this.resultNodes = {}
  }

  componentDidMount () {
    const { searchIndex } = this.props
    searchIndex.initFuseSearch()
    if (this.state.inputValue) {
      this.setState({
        searchResults: searchIndex.fuseSearch(this.state.inputValue)
      })
    }
  }

  selectPreGist () {
    const { selectedIndex, searchResults } = this.state
    let newSelectedIndex = selectedIndex - 1
    if (!searchResults || newSelectedIndex < 0) {
      newSelectedIndex = searchResults.length - 1
    }
    this.setState({
      selectedIndex: newSelectedIndex
    }, () => this.scrollResultIntoView(newSelectedIndex))
  }

  selectNextGist () {
    const { selectedIndex, searchResults } = this.state
    let newSelectedIndex = selectedIndex + 1
    if (!searchResults || newSelectedIndex >= searchResults.length) {
      newSelectedIndex = 0
    }
    this.setState({
      selectedIndex: newSelectedIndex
    }, () => this.scrollResultIntoView(newSelectedIndex))
  }

  setResultNode (index, node) {
    if (node) {
      this.resultNodes[index] = node
    } else {
      delete this.resultNodes[index]
    }
  }

  scrollResultIntoView (index) {
    if (this.resultNodes[index]) {
      this.resultNodes[index].scrollIntoView(false)
    }
  }

  selectCurrentGist () {
    const { selectedIndex, searchResults } = this.state
    if (searchResults && searchResults.length > 0) {
      this.handleSnippetClicked(searchResults[selectedIndex].id)
    }
  }

  handleKeyDown (e) {
    const { updateSearchWindowStatus } = this.props
    if (e.keyCode === 40) { // Down
      e.preventDefault()
      this.selectNextGist()
    } else if (e.keyCode === 38) { // Up
      e.preventDefault()
      this.selectPreGist()
    } else if (e.keyCode === 13) { // Enter
      e.preventDefault()
      this.selectCurrentGist()
    } else if (e.keyCode === 27) { // Esc
      e.preventDefault()
      updateSearchWindowStatus('OFF')
    }
  }

  handleSnippetClicked (gistId) {
    const {
      gists,
      selectGistTag,
      selectGist,
      updateSearchWindowStatus,
      updatescrollRequestStatus,
      fetchSingleGist
    } = this.props

    if (!gists[gistId].details) {
      logger.info('[Dispatch] fetchSingleGist ' + gistId)
      fetchSingleGist(gists[gistId], gistId)
    }

    logger.info('[Dispatch] update scroll request to ON')
    updatescrollRequestStatus('ON')

    logger.info('[Dispatch] selectGist ' + gistId)
    selectGist(gistId)

    selectGistTag(Prefixed('All'))
    updateSearchWindowStatus('OFF')
  }

  updateInputValue (evt) {
    this.setState({
      selectedIndex: 0,
      inputValue: evt.target.value
    })
  }

  queryInputValue (evt) {
    const inputValue = evt.target.value

    const searchIndex = this.props.searchIndex
    const results = searchIndex.fuseSearch(inputValue)
    this.setState({
      searchResults: results
    })
  }

  getSearchTokens () {
    return this.state.inputValue.trim().toLowerCase().split(/\s+/).filter(Boolean)
  }

  mergeHighlightRanges (ranges) {
    const sortedRanges = ranges.slice().sort((left, right) => left[0] - right[0])
    return sortedRanges.reduce((merged, range) => {
      const previous = merged[merged.length - 1]
      if (!previous || range[0] > previous[1] + 1) {
        merged.push(range)
        return merged
      }

      previous[1] = Math.max(previous[1], range[1])
      return merged
    }, [])
  }

  getHighlightSegments (text) {
    if (!text) return []

    const tokens = this.getSearchTokens()
    const lowerText = text.toLowerCase()
    const ranges = []

    tokens.forEach(token => {
      let searchStart = 0
      let matchStart = lowerText.indexOf(token, searchStart)
      while (matchStart !== -1) {
        ranges.push([matchStart, matchStart + token.length - 1])
        searchStart = matchStart + token.length
        matchStart = lowerText.indexOf(token, searchStart)
      }
    })

    if (ranges.length === 0) {
      return [{ text: text, match: false }]
    }

    const mergedRanges = this.mergeHighlightRanges(ranges)
    const segments = []
    let cursor = 0
    mergedRanges.forEach(([start, end]) => {
      if (start > cursor) {
        segments.push({ text: text.slice(cursor, start), match: false })
      }
      segments.push({ text: text.slice(start, end + 1), match: true })
      cursor = end + 1
    })
    if (cursor < text.length) {
      segments.push({ text: text.slice(cursor), match: false })
    }
    return segments
  }

  renderHighlightedSegments (segments) {
    return segments.map((segment, index) => (
      <span
        className={ segment.match ? 'search-match-highlight' : null }
        key={ index }>
        { segment.text }
      </span>
    ))
  }

  renderHighlightedText (text) {
    return this.renderHighlightedSegments(this.getHighlightSegments(text))
  }

  renderSnippetDescription (rawDescription) {
    const { title, description } = descriptionParser(rawDescription)

    const htmlForDescriptionSection = []
    if (title.length > 0) {
      htmlForDescriptionSection.push(
        <div className='title-section' key='title'>{ this.renderHighlightedText(title) }</div>
      )
    }
    htmlForDescriptionSection.push(
      <div className='description-section' key='description'>{ this.renderHighlightedText(description) }</div>
    )

    return (
      <div>
        { htmlForDescriptionSection }
      </div>
    )
  }

  getSearchMatchSource (match) {
    const sourceByKey = {
      id: 'id',
      description: 'description',
      language: 'language',
      filename: 'filename',
      'files.filename': 'filename',
      'files.language': 'language',
      'files.content': 'content'
    }
    return sourceByKey[match.key] || 'description'
  }

  renderSearchMatchLabel (gist) {
    const match = gist.searchMeta && gist.searchMeta.bestMatch
    if (!match) return null

    const source = t(`search.match.${this.getSearchMatchSource(match)}`)
    const title = match.filename
      ? t('search.match.inFile', { source: source, filename: match.filename })
      : source

    return (
      <div className='search-match-label' title={ title }>{ source }</div>
    )
  }

  getSearchContentMatches (gist) {
    const matches = gist.searchMeta && gist.searchMeta.matches
    if (!matches) return []
    return matches.filter(match => match.key === 'files.content' && match.excerpt && match.excerpt.segments.length > 0)
  }

  renderSearchMatchExcerpts (gist) {
    const matches = this.getSearchContentMatches(gist)
    if (matches.length === 0) return null

    return (
      <div>
        { matches.map((match, index) => (
          <div className='search-match-excerpt' key={ `${match.filename || 'content'}-${index}` }>
            { matches.length > 1 && match.filename
              ? <span className='search-match-excerpt-file'>{ match.filename }: </span>
              : null }
            { this.renderHighlightedSegments(match.excerpt.segments) }
          </div>
        )) }
      </div>
    )
  }

  renderUpdatedTime (gist) {
    if (!gist.updated_at) return null

    return (
      <div className='search-updated-time'>
        { t('snippet.lastActive', { time: formatRelativeTime(gist.updated_at) }) }
      </div>
    )
  }

  renderResultCount () {
    const { inputValue, searchResults } = this.state
    if (!inputValue || !searchResults) return null

    const count = searchResults.length
    const label = count === 1
      ? t('search.resultCountOne')
      : t('search.resultCountMany', { count: count })

    return (
      <div className='search-result-count'>{ label }</div>
    )
  }

  renderSearchResults () {
    const { searchResults, selectedIndex, inputValue } = this.state

    // FIXME: In some unknown circumstance, searchResults is undefined. So we put a
    // guard here. We should remove it once we better understand the mechanism
    // behind it.
    if (!inputValue || !searchResults) return null

    if (inputValue.length > 0 && searchResults.length === 0) {
      return (
        <div className='not-found-msg'>
          { t('search.noResults') }
        </div>
      )
    }

    const resultsJSXGroup = []
    searchResults.forEach((gist, index) => {
      const highlightedDescription = gist.description
      let filenames = []

      // FIXME: In some rare cases, gist.filename is undefined in runtime for some unknown reason. So
      // we place a guard here as a workaround.
      if (gist.filename) {
        filenames = gist.filename.split(',').filter(file => file.trim()).map(file => {
          return (
            <div className='gist-tag' key={ file.trim() }>{ this.renderHighlightedText(file) }</div>
          )
        })
      }
      resultsJSXGroup.push(
        <li
          className={ index === selectedIndex
            ? 'search-result-item-selected'
            : 'search-result-item' }
          key={ gist.id }
          ref={ node => this.setResultNode(index, node) }
          onClick={ this.handleSnippetClicked.bind(this, gist.id) }>
          <div className='search-result-header'>
            <div className='snippet-description'>{ this.renderSnippetDescription(highlightedDescription) }</div>
            { this.renderSearchMatchLabel(gist) }
          </div>
          { this.renderSearchMatchExcerpts(gist) }
          <div className='search-result-footer'>
            <div className='gist-tag-group'>{ filenames }</div>
            { this.renderUpdatedTime(gist) }
          </div>
        </li>
      )
    })
    return resultsJSXGroup
  }

  renderSearchModalBody () {
    return (
      <div>
        <div className='search-header'>
          <input
            type="text"
            className='search-box'
            placeholder={ t('search.placeholder') }
            autoFocus
            value={ this.state.inputValue }
            onChange={ this.updateInputValue.bind(this) }
            onKeyDown={ this.handleKeyDown.bind(this) }
            onKeyUp={ this.queryInputValue.bind(this) }/>
          { this.renderResultCount() }
        </div>
        <ul className='result-group'>
          { this.renderSearchResults() }
        </ul>
      </div>
    )
  }

  render () {
    return (
      <div className='search-modal'>
        <Modal.Dialog bsSize='large'>
          <Modal.Body>
            { this.renderSearchModalBody() }
          </Modal.Body>
        </Modal.Dialog>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    searchWindowStatus: state.searchWindowStatus,
    userSessionStatus: state.userSession.activeStatus,
    gists: state.gists
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectGistTag: selectGistTag,
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist,
    updateSearchWindowStatus: updateSearchWindowStatus,
    updatescrollRequestStatus: updatescrollRequestStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(SearchPage)
