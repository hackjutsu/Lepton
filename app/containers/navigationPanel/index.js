'use strict'

import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { remote } from 'electron'
import UserPanel from '../userPanel'
import { parseLangName as Resolved } from '../../utilities/parser'
import { Modal, Button } from 'react-bootstrap'
import {
    selectGist,
    selectGistTag,
    fetchSingleGist,
    updatePinnedTags,
    updatePinnedTagsModalStatus
} from '../../actions'

import './index.scss'

const logger = remote.getGlobal('logger')

class NavigationPanel extends Component {

  constructor(props) {
    super(props);
    this.state = {
      tmpPinnedTags: new Set()
    }
  }

  handleClicked (key) {
    const { selectGistTag, updateActiveGistAfterClicked, gists, gistTags } = this.props
    selectGistTag(key)
    updateActiveGistAfterClicked(gists, gistTags, key)
  }

  renderPinnedTags () {
    const { pinnedTags, gistTags, activeGistTag } = this.props
    const pinnedTagList = []

    pinnedTags.forEach(tag => {
      if (gistTags[tag]) {
        pinnedTagList.push(
          <div key={ tag }>
            <a className={ tag === activeGistTag ? 'active-gist-tag' : 'gist-tag' }
              onClick={ this.handleClicked.bind(this, tag) }>
              #{ tag.startsWith('lang@') ? Resolved(tag) : tag }
            </a>
          </div>
        )
      }
    })

    return pinnedTagList
  } // renderPinnedTags

  renderLangTags () {
    const { gistTags, activeGistTag } = this.props
    const langTagList = []

    Object.keys(gistTags)
    .filter(tag => {
      return tag.startsWith('lang@')
    })
    .sort()
    .forEach(prefixedLang => {
      langTagList.push(
        <div key={ prefixedLang }>
          <a className={ prefixedLang === activeGistTag ? 'active-gist-tag' : 'gist-tag' }
            onClick={ this.handleClicked.bind(this, prefixedLang) }>
            { '#' + Resolved(prefixedLang) }
          </a>
        </div>
      )
    })

    return langTagList
  } // renderLangTags()

  renderCustomTags () {
    const { gistTags, activeGistTag } = this.props
    const customTagList = []

    Object.keys(gistTags)
    .filter(tag => {
      return !tag.startsWith('lang@')
    })
    .sort()
    .forEach(prefixedLang => {
      customTagList.push(
        <div key={ prefixedLang }>
          <a className={ prefixedLang === activeGistTag ? 'active-gist-tag' : 'gist-tag' }
            onClick={ this.handleClicked.bind(this, prefixedLang) }>
            { '#' + Resolved(prefixedLang) }
          </a>
        </div>
      )
    })

    return customTagList
  }

  handleConfigurePinnedTagClicked () {
    const { updatePinnedTagsModalStatus, pinnedTags } = this.props

    this.setState({
      tmpPinnedTags: new Set(pinnedTags)
    })
    updatePinnedTagsModalStatus('ON')
  }

  renderTagSection () {
    return (
      <div className='gist-tag-section'>
        <div className='lang-tag-section-scroll'>
          <div className='lang-tag-section-content'>
            { this.renderLangTags() }
          </div>
        </div>
        <hr/>
        <div className='pinned-tag-section-scroll'>
          <div className='pinned-tag-section-content'>
            { this.renderPinnedTags() }
          </div>
          <a className='configure-tag' onClick={ this.handleConfigurePinnedTagClicked.bind(this) }>shortcuts...</a>
        </div>
        <hr/>
        <div className='custom-tag-section-scroll'>
          <div className='custom-tag-section-content'>
            { this.renderCustomTags() }
          </div>
        </div>
      </div>
    )
  }

  handleTagInPinnedTagsModalClicked (tag) {
    const { tmpPinnedTags } = this.state
    tmpPinnedTags.has(tag)
        ? tmpPinnedTags.delete(tag)
        : tmpPinnedTags.add(tag)
    this.setState({
      tmpPinnedTags: tmpPinnedTags
    })
  }

  closePinnedTagsModal () {
    this.props.updatePinnedTagsModalStatus('OFF')
    this.setState({
      tmpPinnedTags: new Set()
    })
  }

  renderAllTagsForPin () {
    const { gistTags, activeGistTag } = this.props
    const { tmpPinnedTags } = this.state

    const langTags = []
    const customTags = []

    Object.keys(gistTags).sort().forEach(item => {
      item.startsWith('lang@')
        ? langTags.push(item)
        : customTags.push(item)
    })
    const orderedGistTags = [...customTags, ...langTags]

    const tagsForPinRows = []
    let i = 1
    let row = []
    orderedGistTags.forEach(tag => {
      row.push(
          <td key={ tag }>
            <a
              onClick={ this.handleTagInPinnedTagsModalClicked.bind(this, tag) }
              className={ tmpPinnedTags.has(tag) ? 'gist-tag-pinned' : 'gist-tag-not-pinned' }>
              #{ tag.startsWith('lang@') ? Resolved(tag) : tag }
            </a>
          </td>)
      if (i++ % 5 === 0) {
        tagsForPinRows.push(<tr key={ i }>{ row }</tr>)
        row = []
      }
    })

    row && tagsForPinRows.push(<tr key={ i }>{ row }</tr>)

    return (
      <table className='pin-tag-table'>
        <tbody>
        { tagsForPinRows }
        </tbody>
      </table>
    )
  }

  handlePinnedTagSaved () {
    const { tmpPinnedTags } = this.state
    const { updatePinnedTags, userSession } = this.props

    const pinnedTags = Array.from(tmpPinnedTags)
    logger.info('[Dispatch] updatePinnedTags')
    updatePinnedTags(pinnedTags)
    this.closePinnedTagsModal()

    // Saving the pinnedTags to local storage
    const userName = userSession.profile.login
    const localPref = JSON.parse(localStorage.getItem('localPref')) || {}
    localPref[userName] = Object.assign({}, localPref[userName], { pinnedTags })
    logger.debug('Saving... ' + JSON.stringify(localPref))
    localStorage.setItem('localPref', JSON.stringify(localPref))
  }

  renderPinnedTagsModal () {
    const { pinnedTagsModalStatus, pinnedTags } = this.props

    return (
      <Modal
          className='pinned-tags-modal'
          show={ pinnedTagsModalStatus === 'ON' }
          onHide={ this.closePinnedTagsModal.bind(this) }>
          <Modal.Header closeButton>
            <Modal.Title>Shortcuts</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            { this.renderAllTagsForPin() }
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={ this.closePinnedTagsModal.bind(this) }>Cancel</Button>
            <Button bsStyle="success" onClick={ this.handlePinnedTagSaved.bind(this) }>Save</Button>
          </Modal.Footer>
        </Modal>
    )
  }

  render () {
    const {
      searchIndex,
      updateLocalStorage,
      getLoggedInUserInfo,
      reSyncUserGists,
      launchAuthWindow } = this.props

    return (
      <div className='menu-panel'>
        <UserPanel
          className='user-panel'
          searchIndex = { searchIndex }
          updateLocalStorage = { updateLocalStorage }
          getLoggedInUserInfo = { getLoggedInUserInfo }
          reSyncUserGists = { reSyncUserGists }
          launchAuthWindow = { launchAuthWindow }
        />
        <hr/>
        { this.renderTagSection() }
        { this.renderPinnedTagsModal() }
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    gists: state.gists,
    gistTags: state.gistTags,
    pinnedTags: state.pinnedTags,
    userSession: state.userSession,
    activeGistTag: state.activeGistTag,
    pinnedTagsModalStatus: state.pinnedTagsModalStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectGistTag: selectGistTag,
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist,
    updatePinnedTags: updatePinnedTags,
    updatePinnedTagsModalStatus: updatePinnedTagsModalStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(NavigationPanel)
