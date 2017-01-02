'use strict'

import { UPDATE_LANG_TAGS } from '../actions'

export default function (state = {}, action) {
  // console.log('** reducer_langs is triggered with action type: ' + action.type)
  switch (action.type) {
    case UPDATE_LANG_TAGS:
      return action.payload
    default:
  }

  return state
}
