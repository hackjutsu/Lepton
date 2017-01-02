'use strict'

import { SELECT_LANG_TAG } from '../actions'

export default function (state = null, action) {
  // console.log('reducer_active_lang_tag is triggered with action type: ' + action.type)
  switch (action.type) {
    case SELECT_LANG_TAG:
      return action.payload
    default:
  }

  return state
}
