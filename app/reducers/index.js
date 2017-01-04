'use strict'

import { combineReducers } from 'redux'
import AccessTokenReducer from './reducer_token'
import GistsReducer from './reducer_gists'
import SyncTimeReducer from './reducer_sync_time'
import ActiveGistReducer from './reducer_active_gist'
import LangsReducer from './reducer_langs'
import ActiveLangTagReducer from './reducer_active_lang_tag'
import UserSessionReducer from './reducer_user_session'

const rootReducer = combineReducers({
  userSession: UserSessionReducer,
  accessToken: AccessTokenReducer,
  gists: GistsReducer,
  syncTime: SyncTimeReducer,
  activeGist: ActiveGistReducer,
  langTags: LangsReducer,
  activeLangTag: ActiveLangTagReducer
})

export default rootReducer
