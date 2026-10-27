import { LOGOUT_USER_SESSION, UPDATE_PINNED_TAGS } from '../actions'

export default function (state = [], action) {
  switch (action.type) {
    case UPDATE_PINNED_TAGS:
      return [...action.payload]
    case LOGOUT_USER_SESSION:
      return []
    default:
  }
  return state
}
