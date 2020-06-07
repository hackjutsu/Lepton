import { UPDATE_GISTS, UPDATE_SINGLE_GIST } from '../actions'

export default function (state = {}, action) {
  switch (action.type) {
    case UPDATE_GISTS:
      return action.payload
    case UPDATE_SINGLE_GIST:
      return Object.assign({}, state, action.payload)
    default:
  }
  return state
}
