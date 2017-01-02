'use strict'

import { SELECT_GIST } from '../actions'

export default function (state = null, action) {
  // console.log('reducer_active_lang_tag is triggered with action type: ' + action.type)
  switch (action.type) {
    case SELECT_GIST:
      return action.payload
    default:
  }

  return state
}
