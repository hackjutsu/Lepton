'use strict'

import { UPDATE_PINNED_TAGS_MODAL_STATUS } from '../actions'

// FIXME: adopt immutable lib
export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_PINNED_TAGS_MODAL_STATUS:
      return action.payload
    default:
  }

  return state
}
