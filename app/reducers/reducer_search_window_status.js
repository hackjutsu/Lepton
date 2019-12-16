import { UPDATE_SEARCHWINDOW_STATUS } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_SEARCHWINDOW_STATUS:
      return action.payload
    default:
  }

  return state
}
