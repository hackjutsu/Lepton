import { UPDATE_NEW_VERSION_INFO } from '../actions'

export default function (state = { version: '', url: '' }, action) {
  switch (action.type) {
    case UPDATE_NEW_VERSION_INFO:
      return action.payload
    default:
  }
  return state
}
