'use strict'

import { UPDATE_USER_SESSION, LOGOUT_USER_SESSION } from '../actions'

export default function (state = { active: 'false' }, action) {
  switch (action.type) {
    case UPDATE_USER_SESSION:
      return action.payload
    case LOGOUT_USER_SESSION:
      return Object.assign({}, { active: 'false' })
    default:
  }
  return state
}
