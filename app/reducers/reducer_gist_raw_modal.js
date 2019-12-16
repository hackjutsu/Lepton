import { UPDATE_GIST_RAW_MODAL } from '../actions'

export default function (state = { status: 'OFF', file: null, content: null, link: null }, action) {
  switch (action.type) {
    case UPDATE_GIST_RAW_MODAL:
      return Object.assign({}, state, action.payload)
    default:
  }

  return state
}
