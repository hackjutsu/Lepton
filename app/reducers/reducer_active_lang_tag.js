'use strict'

import { SELECT_LANG_TAG, LOGOUT_USER_SESSION } from '../actions'

export default function (state = 'All', action) {
  switch (action.type) {
    case SELECT_LANG_TAG:
      return action.payload
    case LOGOUT_USER_SESSION:
      return 'All'
    default:
  }

  return state
}
