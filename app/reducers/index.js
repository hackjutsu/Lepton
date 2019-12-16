import { combineReducers } from 'redux'
import { reducer as form } from 'redux-form'
import aboutModalStatus from './reducer_about_modal'
import accessToken from './reducer_token'
import activeGist from './reducer_active_gist'
import activeGistTag from './reducer_active_gist_tag'
import authWindowStatus from './reducer_auth_window_status'
import dashboardModalStatus from './reducer_dashboard_modal'
import fileExpandStatus from './reducer_file_expand_status'
import gistDeleteModalStatus from './reducer_gist_delete_modal'
import gistEditModalStatus from './reducer_gist_edit_modal'
import gistNewModalStatus from './reducer_gist_new_modal'
import gistRawModal from './reducer_gist_raw_modal'
import gists from './reducer_gists'
import gistSyncStatus from './reducer_gist_sync_status'
import gistTags from './reducer_gist_tags'
import immersiveMode from './reducer_immersive_mode'
import logoutModalStatus from './reducer_logout_modal'
import newVersionInfo from './reducer_new_version_info'
import pinnedTags from './reducer_pinned_tags'
import pinnedTagsModalStatus from './reducer_pinned_tags_selections_modal'
import scrollRequestStatus from './reducer_scroll_request_status'
import searchWindowStatus from './reducer_search_window_status'
import syncTime from './reducer_sync_time'
import updateAvailableBarStatus from './reducer_update_available_bar_status'
import userSession from './reducer_user_session'

const rootReducer = combineReducers({
  aboutModalStatus,
  accessToken,
  activeGist,
  activeGistTag,
  authWindowStatus,
  dashboardModalStatus,
  fileExpandStatus,
  form,
  gistDeleteModalStatus,
  gistEditModalStatus,
  gistNewModalStatus,
  gistRawModal,
  gists,
  gistSyncStatus,
  gistTags,
  immersiveMode,
  logoutModalStatus,
  newVersionInfo,
  pinnedTags,
  pinnedTagsModalStatus,
  scrollRequestStatus,
  searchWindowStatus,
  syncTime,
  updateAvailableBarStatus,
  userSession,
})

export default rootReducer
