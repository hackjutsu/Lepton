'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Button, Image, Modal, ListGroupItem, ListGroup } from 'react-bootstrap'
import { selectLangTag, selectGist, fetchSingleGist, updateSearchWindowStatus } from '../../actions/index'
import { bindActionCreators } from 'redux'

import './index.scss'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

class SearchPage extends Component {

  constructor (props) {
    super(props)

    this.state = {
      inputValue: '',
      searchResults: []
    }
  }

  handleSnippetClicked (gistId) {
    let { gists, selectLangTag, selectGist, updateSearchWindowStatus } = this.props

    logger.debug('User clicked on ' + gistId)
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
      inputValue: evt.target.value
    })
  }

  queryInputValue (evt) {
    let inputValue = evt.target.value
    // if (inputValue.length < 2) return

    let searchIndex = this.props.searchIndex
    let results = searchIndex.searchFromIndex(inputValue)
    this.setState({
      searchResults: results
    })
  }

  renderSearchResults () {
    let { inputValue, searchResults } = this.state
    let { gists } = this.props

    let resultsJSXGroup = []
    searchResults && searchResults.forEach(item => {
      let gist = gists[item.ref]
      let gistDescription = gist.brief.description
      let highlightedDescription = gistDescription.replace(inputValue, '**' + inputValue + '**')
      let langs = [...gist.langs]
      resultsJSXGroup.push(
        <ListGroupItem key={ item.ref } onClick={ this.handleSnippetClicked.bind(this, item.ref) }>
          <div>{ langs }</div>
          { highlightedDescription }
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
          name="txt"
          className='search-box'
          value={ this.state.inputValue }
          onChange={ this.updateInputValue.bind(this) }
          onKeyUp={ this.queryInputValue.bind(this) }/>
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
    updateSearchWindowStatus: updateSearchWindowStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(SearchPage)
