'use strict'

import { combineReducers } from 'redux'
import { reducer as formReducer } from 'redux-form'
import AccessTokenReducer from './reducer_token'
import GistsReducer from './reducer_gists'
import SyncTimeReducer from './reducer_sync_time'
import ActiveGistReducer from './reducer_active_gist'
import LangsReducer from './reducer_langs'
import ActiveLangTagReducer from './reducer_active_lang_tag'
import UserSessionReducer from './reducer_user_session'
import AuthWindowStatusReducer from './reducer_auth_window_status'
import GistSyncStatusReducer from './reducer_gist_sync_status'
import SearchWindowStatusReducer from './reducer_search_window_status'

const rootReducer = combineReducers({
  form: formReducer,
  userSession: UserSessionReducer,
  accessToken: AccessTokenReducer,
  gists: GistsReducer,
  syncTime: SyncTimeReducer,
  activeGist: ActiveGistReducer,
  langTags: LangsReducer,
  activeLangTag: ActiveLangTagReducer,
  authWindowStatus: AuthWindowStatusReducer,
  gistSyncStatus: GistSyncStatusReducer,
  searchWindowStatus: SearchWindowStatusReducer
})

export default rootReducer
