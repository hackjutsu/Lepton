import { UPDATE_FILE_EXPAND_STATUS } from '../actions'

export default function (state = [], action) {
  switch (action.type) {
    case UPDATE_FILE_EXPAND_STATUS:
      return Object.assign({}, action.payload)
    default:
  }
  return state
}
