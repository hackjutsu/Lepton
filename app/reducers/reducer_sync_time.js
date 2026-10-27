import { LOGOUT_USER_SESSION, UPDATE_SYNC_TIME } from '../actions'

export default function (state = null, action) {
  switch (action.type) {
    case UPDATE_SYNC_TIME:
      return action.payload
    case LOGOUT_USER_SESSION:
      return null
    default:
  }

  return state
}
