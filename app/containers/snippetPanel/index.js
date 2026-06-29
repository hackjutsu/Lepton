import { connect } from 'react-redux'
import { Well } from 'react-bootstrap'
import React, { Component } from 'react'
import Snippet from '../snippet'
import { t } from '../../utilities/i18n'

import './index.scss'

class SnippetPanel extends Component {
  renderEmptySnippetSection () {
    // This happens when the user has no gists
    return (
      <Well className='welcome-section'>{ t('welcome.emptySnippet') }</Well>
    )
  }

  renderNormalSnippetSection () {
    const { gists, activeGist, searchIndex, reSyncUserGists } = this.props
    return (
      <Snippet
        searchIndex = { searchIndex }
        reSyncUserGists={ reSyncUserGists }
        snippet={ gists[activeGist] } />
    )
  }

  render () {
    const { gists, activeGist, immersiveMode } = this.props
    return (
      <div className={ immersiveMode === 'ON' ? 'snippet-panel-immersive' : 'snippet-panel' }>
        <div className='snippet-panel-content'>
          { !gists || !activeGist || !gists[activeGist]
            ? this.renderEmptySnippetSection()
            : this.renderNormalSnippetSection() }
        </div>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    activeGist: state.activeGist,
    gists: state.gists,
    immersiveMode: state.immersiveMode
  }
}

export default connect(mapStateToProps)(SnippetPanel)
