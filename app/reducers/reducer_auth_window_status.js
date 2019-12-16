import { UPDATE_AUTHWINDOW_STATUS } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_AUTHWINDOW_STATUS:
      return action.payload
    default:
  }

  return state
}
