import { UPDATE_GIST_TAGS, LOGOUT_USER_SESSION } from '../actions'

export default function (state = {}, action) {
  switch (action.type) {
    case UPDATE_GIST_TAGS:
      return action.payload
    case LOGOUT_USER_SESSION:
      return null
    default:
  }
  return state
}
