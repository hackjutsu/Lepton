import React from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import OriginalAppContainer from '../../../app/containers/appContainer/index'
import { updateUpdateAvailableBarStatus } from '../../../app/actions'

class ResizableAppContainer extends OriginalAppContainer.WrappedComponent {
  renderActiveNormalSection () {
    const section = super.renderActiveNormalSection()
    return React.cloneElement(section, null, React.Children.map(section.props.children, child => {
      if (!React.isValidElement(child) || child.props.className !== 'content-split-pane') return child
      return React.cloneElement(child, null, React.Children.map(child.props.children, (pane, index) =>
        React.cloneElement(pane, index === 0 ? { maxSize: 650 } : { minSize: 260 })))
    }))
  }
}

const mapState = state => ({
  userSession: state.userSession,
  searchWindowStatus: state.searchWindowStatus,
  aboutModalStatus: state.aboutModalStatus,
  dashboardModalStatus: state.dashboardModalStatus,
  gistDeleteModalStatus: state.gistDeleteModalStatus,
  gistEditModalStatus: state.gistEditModalStatus,
  gistNewModalStatus: state.gistNewModalStatus,
  gistRawModal: state.gistRawModal,
  logoutModalStatus: state.logoutModalStatus,
  pinnedTagsModalStatus: state.pinnedTagsModalStatus,
  newVersionInfo: state.newVersionInfo,
  updateAvailableBarStatus: state.updateAvailableBarStatus,
  immersiveMode: state.immersiveMode
})
const mapDispatch = dispatch => bindActionCreators({ updateUpdateAvailableBarStatus }, dispatch)
export default connect(mapState, mapDispatch)(ResizableAppContainer)
