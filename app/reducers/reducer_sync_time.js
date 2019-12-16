import { UPDATE_SYNC_TIME } from '../actions'

export default function (state = null, action) {
  switch (action.type) {
    case UPDATE_SYNC_TIME:
      return action.payload
    default:
  }

  return state
}
