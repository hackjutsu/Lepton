'use strict'

import { UPDATE_LANG_TAGS } from '../actions'

export default function (state = {}, action) {
  switch (action.type) {
    case UPDATE_LANG_TAGS:
      return action.payload
    default:
  }
  return state
}
