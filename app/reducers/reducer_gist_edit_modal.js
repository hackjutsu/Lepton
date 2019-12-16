import { UPDATE_GIST_EDIT_MODAL } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_GIST_EDIT_MODAL:
      return action.payload
    default:
  }

  return state
}
