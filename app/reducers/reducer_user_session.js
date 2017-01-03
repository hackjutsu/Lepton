'use strict'

import { UPDATE_USER_SESSION } from '../actions'

export default function (state = {active: 'false'}, action) {
  switch (action.type) {
    case UPDATE_USER_SESSION:
      return action.payload
    default:
  }
  return state
}
