import { SELECT_GIST, LOGOUT_USER_SESSION } from '../actions'

export default function (state = null, action) {
  switch (action.type) {
    case SELECT_GIST:
      return action.payload
    case LOGOUT_USER_SESSION:
      return null
    default:
  }

  return state
}
