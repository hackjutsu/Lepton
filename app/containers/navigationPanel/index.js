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

import plusIcon from './plus.svg'

import './index.scss'

const conf = remote.getGlobal('conf')
const logger = remote.getGlobal('logger')

class NavigationPanel extends Component {
  constructor (props) {
    super(props)
    const { localPref, userSession } = this.props

    const userName = userSession.profile.login
    let activeSection = -1
    if (localPref && localPref.get(userName)) {
      const cachedActiveSession = localPref.get(userName).activeSection
      if (cachedActiveSession !== undefined) {
        activeSection = cachedActiveSession
      }
    }
    logger.debug(`-----> The tag activeSection is ${activeSection}`)

    this.state = {
      tmpPinnedTags: new Set(),
      activeSection,
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

  handleSectionClick (index) {
    const { activeSection } = this.state
    const { localPref, userSession } = this.props

    const nextActiveSection = activeSection === index ? -1 : index
    this.setState({
      activeSection: nextActiveSection
    })

    // Saving the activeSection to local preference
    const userName = userSession.profile.login
    logger.debug(`-----> Saving new tag activeSection ${nextActiveSection}`)
    localPref.set(userName,
      Object.assign({}, localPref.get(userName), { activeSection: nextActiveSection }))
  }

  renderTagSection () {
    const { userSession } = this.props
    const { activeSection } = this.state

    let gitHubHost = 'github.com'
    if (conf.get('enterprise:enable')) {
      gitHubHost = conf.get('enterprise:host')
    }

    return (
      <div className='gist-tag-section'>
        <div className='starred-tag-section'>
          <div className='tag-section-content'>
            <a className='gist-tag' href={ `https://gist.${gitHubHost}/${userSession.profile.login}/starred` }>#starred</a>
          </div>
        </div>
        <div className='tag-section-list'>
          <div
            className={
              activeSection === 0 ? 'tag-section tag-section-active'
                : activeSection === -1 ? 'tag-section'
                  : 'tag-section tag-section-hidden'}>
            <a href='#'
              className='tag-section-title'
              onClick={this.handleSectionClick.bind(this, 0)}>
              Languages</a>
            <div className='tag-section-content'>
              { this.renderLangTags() }
            </div>
          </div>
          <div
            className={
              activeSection === 1 ? 'tag-section tag-section-active'
                : activeSection === -1 ? 'tag-section'
                  : 'tag-section tag-section-hidden'}>
            <div className='pinned-tag-header'>
              <a href='#'
                onClick={this.handleSectionClick.bind(this, 1)}
                className='tag-section-title'>
                Pinned
              </a>
              <a className='configure-tag' onClick={ this.handleConfigurePinnedTagClicked.bind(this) }>
                <div dangerouslySetInnerHTML={{ __html: plusIcon }} />
              </a>
            </div>
            <div className='tag-section-content'>
              { this.renderPinnedTags() }
            </div>
          </div>
          <div className={
            activeSection === 2 ? 'tag-section tag-section-active'
              : activeSection === -1 ? 'tag-section'
                : 'tag-section tag-section-hidden'}>
            <a href='#'
              onClick={this.handleSectionClick.bind(this, 2)}
              className='tag-section-title'>Tags</a>
            <div className='tag-section-content'>
              { this.renderCustomTags() }
            </div>
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
    const { gistTags } = this.props
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
    const { updatePinnedTags, userSession, localPref } = this.props

    const pinnedTags = Array.from(tmpPinnedTags)
    logger.info('[Dispatch] updatePinnedTags')
    updatePinnedTags(pinnedTags)
    this.closePinnedTagsModal()

    // Saving the pinnedTags to local preference
    const userName = userSession.profile.login
    localPref.set(userName, Object.assign({}, localPref.get(userName), { pinnedTags }))
  }

  renderPinnedTagsModal () {
    const { pinnedTagsModalStatus } = this.props

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
