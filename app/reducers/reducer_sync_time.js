'use strict'

import { UPDATE_SYNC_TIME } from '../actions'

export default function (state = null, action) {
  // console.log('reducer_active_lang_tag is triggered with action type: ' + action.type)
  switch (action.type) {
    case UPDATE_SYNC_TIME:
      return action.payload
    default:
  }

  return state
}
