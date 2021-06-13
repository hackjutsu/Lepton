import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Modal } from 'react-bootstrap'
import { remote } from 'electron'
import React, { Component } from 'react'
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

const logger = remote.getGlobal('logger')

class SearchPage extends Component {
  constructor (props) {
    super(props)
    this.state = {
      inputValue: '',
      selectedIndex: 0,
      searchResults: []
    }
  }

  componentWillMount () {
    const { searchIndex } = this.props
    searchIndex.initFuseSearch()
  }

  selectPreGist () {
    const { selectedIndex, searchResults } = this.state
    let newSelectedIndex = selectedIndex - 1
    if (!searchResults || newSelectedIndex < 0) {
      newSelectedIndex = searchResults.length - 1
    }
    this.setState({
      selectedIndex: newSelectedIndex,
    })
    this.refs[newSelectedIndex].scrollIntoView(false)
  }

  selectNextGist () {
    const { selectedIndex, searchResults } = this.state
    let newSelectedIndex = selectedIndex + 1
    if (!searchResults || newSelectedIndex >= searchResults.length) {
      newSelectedIndex = 0
    }
    this.setState({
      selectedIndex: newSelectedIndex,
    })
    this.refs[newSelectedIndex].scrollIntoView(false)
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

  renderSnippetDescription (rawDescription) {
    const { title, description } = descriptionParser(rawDescription)

    const htmlForDescriptionSection = []
    if (title.length > 0) {
      htmlForDescriptionSection.push(<div className='title-section' key='title'>{ title }</div>)
    }
    htmlForDescriptionSection.push(<div className='description-section' key='description'>{ description }</div>)

    return (
      <div>
        { htmlForDescriptionSection }
      </div>
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
          No result found...
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
            <div className='gist-tag' key={ file.trim() }>{ file }</div>
          )
        })
      }
      resultsJSXGroup.push(
        <li
          className={ index === selectedIndex
            ? 'search-result-item-selected'
            : 'search-result-item' }
          key={ gist.id }
          ref={ index }
          onClick={ this.handleSnippetClicked.bind(this, gist.id) }>
          <div className='snippet-description'>{ this.renderSnippetDescription(highlightedDescription) }</div>
          <div className='gist-tag-group'>{ filenames }</div>
        </li>
      )
    })
    return resultsJSXGroup
  }

  renderSearchModalBody () {
    return (
      <div>
        <input
          type="text"
          className='search-box'
          placeholder='Search for description, tags, file names...'
          autoFocus
          value={ this.state.inputValue }
          onChange={ this.updateInputValue.bind(this) }
          onKeyDown={ this.handleKeyDown.bind(this) }
          onKeyUp={ this.queryInputValue.bind(this) }/>
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
    searchWindowStatus: state.authWindowStatus,
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
