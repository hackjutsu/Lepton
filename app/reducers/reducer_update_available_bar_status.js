import { UPDATE_UPDATEAVAILABLEBAR_STATUS } from '../actions'

export default function (state = 'OFF', action) {
  switch (action.type) {
    case UPDATE_UPDATEAVAILABLEBAR_STATUS:
      return action.payload
    default:
  }

  return state
}
