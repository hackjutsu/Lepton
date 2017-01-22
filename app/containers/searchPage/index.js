'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Button, Image, Modal, ListGroupItem, ListGroup } from 'react-bootstrap'

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
        <ListGroupItem key={ item.ref }>
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

export default connect(mapStateToProps)(SearchPage)
