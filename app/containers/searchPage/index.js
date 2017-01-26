'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Modal, ListGroupItem, ListGroup } from 'react-bootstrap'
import {
  selectLangTag,
  selectGist,
  fetchSingleGist,
  updateSearchWindowStatus} from '../../actions/index'
import { bindActionCreators } from 'redux'
import descriptionParser from '../../utilities/descriptionParser'

import './index.scss'

import { remote, ipcRenderer } from 'electron'
const logger = remote.getGlobal('logger')

class SearchPage extends Component {

  constructor (props) {
    super(props)
    this.keyEvents = ipcRenderer
    this.state = {
      inputValue: '',
      selectedIndex: 0,
      searchResults: []
    }
  }

  componentWillMount () {
    ipcRenderer.on('key-up', this.selectPreGist.bind(this))
    ipcRenderer.on('key-down', this.selectNextGist.bind(this))
    ipcRenderer.on('key-enter', this.selectCurrentGist.bind(this))
    ipcRenderer.on('key-escape', () => {
      this.props.updateSearchWindowStatus('OFF')
    })
  }

  componentWillUnmount () {
    this.keyEvents.removeAllListeners('key-up')
    this.keyEvents.removeAllListeners('key-down')
    this.keyEvents.removeAllListeners('key-enter')
  }

  selectPreGist () {
    let { selectedIndex, searchResults } = this.state
    selectedIndex = selectedIndex - 1
    if (!searchResults || selectedIndex < 0) {
      selectedIndex = searchResults.length - 1
    }
    this.setState({
      selectedIndex: selectedIndex,
    })
  }

  selectNextGist () {
    let { selectedIndex, searchResults } = this.state
    selectedIndex = selectedIndex + 1
    if (!searchResults || selectedIndex >= searchResults.length) {
      selectedIndex = 0
    }
    this.setState({
      selectedIndex: selectedIndex,
    })
  }

  selectCurrentGist () {
    let { selectedIndex, searchResults } = this.state
    if (searchResults && searchResults.length > 0) {
      this.handleSnippetClicked(searchResults[selectedIndex].ref)
    }
  }

  handleSnippetClicked (gistId) {
    let { gists, selectLangTag, selectGist, updateSearchWindowStatus, fetchSingleGist } = this.props

    if (!gists[gistId].details) {
      logger.info('** dispatch fetchSingleGist ' + gistId)
      fetchSingleGist(gists[gistId], gistId)
    }
    logger.info('** dispatch selectGist ' + gistId)
    selectGist(gistId)

    selectLangTag('All')
    updateSearchWindowStatus('OFF')
  }

  updateInputValue (evt) {
    this.setState({
      selectedIndex: 0,
      inputValue: evt.target.value
    })
  }

  queryInputValue (evt) {
    let inputValue = evt.target.value

    let searchIndex = this.props.searchIndex
    let results = searchIndex.searchFromIndex(inputValue)
    this.setState({
      searchResults: results
    })
  }

  renderSnippetDescription (rawDescription) {
    let { title, description, keywords } = descriptionParser(rawDescription)

    let htmlForDescriptionSection = []
    if (title.length > 0) {
      htmlForDescriptionSection.push(<div className='title-section' key='title'>{ title }</div>)
    }
    htmlForDescriptionSection.push(<div className='description-section' key='description'>{ description }</div>)
    // if (keywords.length > 0) {
    //   htmlForDescriptionSection.push(<div className='keywords-section' key='keywords'>{ keywords }</div>)
    // }

    return (
      <div>
        { htmlForDescriptionSection }
      </div>
    )
  }

  renderSearchResults () {
    let { searchResults, selectedIndex, inputValue } = this.state
    let { gists } = this.props

    // In some unknown circumstance, searchResults is undefined. So we put a
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

    let resultsJSXGroup = []
    searchResults.forEach((item, index) => {
      let gist = gists[item.ref]
      let gistDescription = gist.brief.description
      // let highlightedDescription = gistDescription.replace(inputValue, '**' + inputValue + '**')
      let highlightedDescription = gistDescription
      let langs = [...gist.langs].map(lang => {
        return (
          <div className='lang-tag' key={ lang }>{ '#' + lang }</div>
        )
      })
      resultsJSXGroup.push(
        <ListGroupItem
          className={ index === selectedIndex
              ? 'search-result-item-selected' : 'search-result-item' }
          key={ item.ref }
          onClick={ this.handleSnippetClicked.bind(this, item.ref) }>
          <div className='snippet-description'>{ this.renderSnippetDescription(highlightedDescription) }</div>
          <div className='lang-tag-group'>{ langs }</div>
        </ListGroupItem>
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
          placeholder='Search...'
          autoFocus
          value={ this.state.inputValue }
          onChange={ this.updateInputValue.bind(this) }
          onKeyUp={ this.queryInputValue.bind(this) }/>
        <div className='tip'>Navigation: Shift+Up/Down | Select: Shift+Enter</div>
        <ListGroup>
          { this.renderSearchResults() }
        </ListGroup>
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
    selectLangTag: selectLangTag,
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist,
    updateSearchWindowStatus: updateSearchWindowStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(SearchPage)
