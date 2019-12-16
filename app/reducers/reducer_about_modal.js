import { UPDATE_ABOUT_MODAL_STATUS } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_ABOUT_MODAL_STATUS:
      return action.payload
    default:
  }

  return state
}
