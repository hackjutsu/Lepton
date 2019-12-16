import { UPDATE_USER_SESSION, LOGOUT_USER_SESSION } from '../actions'

export default function (state = { activeStatus: 'INACTIVE' }, action) {
  switch (action.type) {
    case UPDATE_USER_SESSION:
      return action.payload
    case LOGOUT_USER_SESSION:
      return Object.assign({}, { activeStatus: 'INACTIVE' })
    default:
  }
  return state
}
