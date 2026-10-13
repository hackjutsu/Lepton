import { LOGOUT_USER_SESSION, UPDATE_ACCESS_TOKEN, REMOVE_ACCESS_TOKEN } from '../actions'

export default function (state = null, action) {
  switch (action.type) {
    case UPDATE_ACCESS_TOKEN:
      return action.payload
    case REMOVE_ACCESS_TOKEN:
    case LOGOUT_USER_SESSION:
      return null
    default:
  }
  return state
}
