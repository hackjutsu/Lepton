'use strict'

import { combineReducers } from 'redux'
import { reducer as formReducer } from 'redux-form'
import AccessTokenReducer from './reducer_token'
import GistsReducer from './reducer_gists'
import SyncTimeReducer from './reducer_sync_time'
import ActiveGistReducer from './reducer_active_gist'
import GistTagsReducer from './reducer_gist_tags'
import ActiveGistTagReducer from './reducer_active_gist_tag'
import UserSessionReducer from './reducer_user_session'
import AuthWindowStatusReducer from './reducer_auth_window_status'
import GistSyncStatusReducer from './reducer_gist_sync_status'
import SearchWindowStatusReducer from './reducer_search_window_status'
import UpdateAvailableBarStatusReducer from './reducer_update_available_bar_status'
import NewVersionInfoReducer from './reducer_new_version_info'

const rootReducer = combineReducers({
  form: formReducer,
  userSession: UserSessionReducer,
  accessToken: AccessTokenReducer,
  gists: GistsReducer,
  syncTime: SyncTimeReducer,
  activeGist: ActiveGistReducer,
  gistTags: GistTagsReducer,
  activeGistTag: ActiveGistTagReducer,
  authWindowStatus: AuthWindowStatusReducer,
  gistSyncStatus: GistSyncStatusReducer,
  searchWindowStatus: SearchWindowStatusReducer,
  updateAvailableBarStatus: UpdateAvailableBarStatusReducer,
  newVersionInfo: NewVersionInfoReducer
})

export default rootReducer
