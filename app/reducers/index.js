'use strict'

import { combineReducers } from 'redux'
import GistsReducer from './reducer_gists'
import ActiveGistReducer from './reducer_active_gist'
import LangsReducer from './reducer_langs'
import ActiveLangTagReducer from './reducer_active_lang_tag'

const rootReducer = combineReducers({
  gists: GistsReducer,
  activeGist: ActiveGistReducer,
  langTags: LangsReducer,
  activeLangTag: ActiveLangTagReducer
})

export default rootReducer
