'use strict'

import { SELECT_GIST, LOGOUT_USER_SESSION } from '../actions'

export default function (state = null, action) {
  // console.log('reducer_active_lang_tag is triggered with action type: ' + action.type)
  switch (action.type) {
    case SELECT_GIST:
      return action.payload
    case LOGOUT_USER_SESSION:
      return null
    default:
  }

  return state
}
