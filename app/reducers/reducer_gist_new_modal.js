import { UPDATE_GIST_NEW_MODAL } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_GIST_NEW_MODAL:
      return action.payload
    default:
  }

  return state
}
