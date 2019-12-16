import { UPDATE_GIST_SYNC_STATUS } from '../actions'

export default function (state = 'DONE', action) {
  switch (action.type) {
    case UPDATE_GIST_SYNC_STATUS:
      return action.payload
    default:
  }

  return state
}
