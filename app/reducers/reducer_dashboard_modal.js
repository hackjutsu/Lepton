'use strict'

import { UPDATE_DASHBOARD_MODAL_STATUS } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_DASHBOARD_MODAL_STATUS:
      return action.payload
    default:
  }

  return state
}
