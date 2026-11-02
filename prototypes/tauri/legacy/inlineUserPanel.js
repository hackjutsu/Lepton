import React from 'react'
import { createPortal } from 'react-dom'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import OriginalUserPanel from '../../../app/containers/userPanel/index'
import Panel from '../../../app/containers/compatPanel'
import DiscardConfirmation, { hasUnsavedForm } from './discardConfirmation'
import { getInitialValuesKey } from '../../../app/containers/gistEditorForm/formState'
import { t } from '../../../app/utilities/i18n'
import { editorActions, activateFormButton, lockEditorNavigation } from './editorToolbar'
import { logoutUserSession, selectGist, updateGistFilters, updateGistNewModeStatus, updateGistTags, updateLogoutModalStatus, updateSingleGist } from '../../../app/actions'

class InlineUserPanel extends OriginalUserPanel.WrappedComponent {
  componentDidUpdate (previousProps) {
    if (previousProps.gistNewModalStatus !== this.props.gistNewModalStatus) {
      const open = this.props.gistNewModalStatus === 'ON'
      document.body.classList.toggle('lepton-creating-snippet', open)
      lockEditorNavigation(open)
      if (open) {
        this.newEditorBaselineKey = getInitialValuesKey(this.createEmptyNewGistData())
        this.formPanel?.querySelector('.gist-editor-input-area')?.focus()
      }
    }
  }

  handleCreateSingleGist (data) {
    const result = super.handleCreateSingleGist(data)
    this.pendingNewDraft = this.newGistInitialData
    return Promise.resolve(result).finally(() => { this.pendingNewDraft = null })
  }

  closeGistEditorModal () {
    if (this.props.gistNewModalStatus !== 'ON') return
    if (this.pendingNewDraft) {
      if (this.pendingNewDraft === this.newGistInitialData) return
      return this.discardEditor()
    }
    if (hasUnsavedForm(this.newEditorForm, this.newEditorBaselineKey)) {
      this.setState({ confirmDiscard: true })
      return
    }
    this.discardEditor()
  }

  discardEditor () {
    this.setState({ confirmDiscard: false })
    super.closeGistEditorModal()
  }

  componentWillUnmount () {
    document.body.classList.remove('lepton-creating-snippet')
    if (this.props.gistNewModalStatus === 'ON') lockEditorNavigation(false)
    super.componentWillUnmount()
  }

  renderGistEditorModal () {
    if (this.props.gistNewModalStatus !== 'ON') return null
    const target = document.querySelector('.snippet-panel-content')
    if (!target) return null
    return createPortal(
      <div className='snippet-box inline-new-editor' ref={ node => { this.formPanel = node } }>
        <Panel className='snippet-code'>
          <Panel.Heading><div className='header-table'><div className='line'>
            <div className='header-title'>{ t('userPanel.new') }</div>
            <div className='header-controls inline-edit-actions'>
              { editorActions(() => activateFormButton(this.formPanel, false), () => activateFormButton(this.formPanel, true)) }
            </div>
          </div></div></Panel.Heading>
          <Panel.Body>{ this.renderNewGistDraftCallout() }{ React.cloneElement(this.renderGistEditorModalBody(), { ref: form => { this.newEditorForm = form } }) }</Panel.Body>
        </Panel>
        <DiscardConfirmation show={ Boolean(this.state.confirmDiscard) } onKeepEditing={ () => this.setState({ confirmDiscard: false }) } onDiscard={ () => this.discardEditor() } />
      </div>, target)
  }
}

const mapState = state => ({
  userSession: state.userSession,
  syncTime: state.syncTime,
  accessToken: state.accessToken,
  gistTags: state.gistTags,
  gistSyncStatus: state.gistSyncStatus,
  logoutModalStatus: state.logoutModalStatus,
  gistNewModalStatus: state.gistNewModalStatus
})
const mapDispatch = dispatch => bindActionCreators({ logoutUserSession, selectGist, updateGistFilters, updateGistNewModeStatus, updateGistTags, updateLogoutModalStatus, updateSingleGist }, dispatch)
export default connect(mapState, mapDispatch)(InlineUserPanel)
