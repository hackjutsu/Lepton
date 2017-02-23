'use strict'

import { combineReducers } from 'redux'
import { reducer as form } from 'redux-form'
import accessToken from './reducer_token'
import gists from './reducer_gists'
import syncTime from './reducer_sync_time'
import activeGist from './reducer_active_gist'
import gistTags from './reducer_gist_tags'
import pinnedTags from './reducer_pinned_tags'
import activeGistTag from './reducer_active_gist_tag'
import userSession from './reducer_user_session'
import authWindowStatus from './reducer_auth_window_status'
import gistSyncStatus from './reducer_gist_sync_status'
import searchWindowStatus from './reducer_search_window_status'
import scrollRequestStatus from './reducer_scroll_request_status'
import updateAvailableBarStatus from './reducer_update_available_bar_status'
import newVersionInfo from './reducer_new_version_info'
import immersiveMode from './reducer_immersive_mode'
import logoutModalStatus from './reducer_logout_modal'
import gistRawModal from './reducer_gist_raw_modal'
import gistEditModalStatus from './reducer_gist_edit_modal'
import gistNewModalStatus from './reducer_gist_new_modal'
import gistDeleteModalStatus from './reducer_gist_delete_modal'
import preferenceModalStatus from './reducer_preference_modal'
import pinnedTagsModalStatus from './reducer_pinned_tags_selections_modal'
import fileExpandStatus from './reducer_file_expand_status'

const rootReducer = combineReducers({
  form,
  userSession,
  accessToken,
  gists,
  syncTime,
  activeGist,
  gistTags,
  pinnedTags,
  activeGistTag,
  authWindowStatus,
  gistSyncStatus,
  searchWindowStatus,
  scrollRequestStatus,
  updateAvailableBarStatus,
  newVersionInfo,
  immersiveMode,
  logoutModalStatus,
  gistRawModal,
  gistEditModalStatus,
  gistNewModalStatus,
  gistDeleteModalStatus,
  preferenceModalStatus,
  pinnedTagsModalStatus,
  fileExpandStatus
})

export default rootReducer
