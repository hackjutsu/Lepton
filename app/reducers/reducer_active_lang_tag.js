'use strict'

import { SELECT_LANG_TAG, LOGOUT_USER_SESSION } from '../actions'

export default function (state = 'All', action) {
  // console.log('reducer_active_lang_tag is triggered with action type: ' + action.type)
  switch (action.type) {
    case SELECT_LANG_TAG:
      return action.payload
    case LOGOUT_USER_SESSION:
      return 'All'
    default:
  }

  return state
}
