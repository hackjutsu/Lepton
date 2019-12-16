import { SELECT_GIST_TAG, LOGOUT_USER_SESSION } from '../actions'
import { addLangPrefix as Prefixed } from '../utilities/parser'

export default function (state = Prefixed('All'), action) {
  switch (action.type) {
    case SELECT_GIST_TAG:
      return action.payload
    case LOGOUT_USER_SESSION:
      return Prefixed('All')
    default:
  }

  return state
}
