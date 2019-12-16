import { UPDATE_SCROLL_REQUEST_STATUS } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_SCROLL_REQUEST_STATUS:
      return action.payload
    default:
  }

  return state
}
