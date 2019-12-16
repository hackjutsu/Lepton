import { UPDATE_IMMERSIVE_MODE_STATUS } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_IMMERSIVE_MODE_STATUS:
      return action.payload
    default:
  }

  return state
}
