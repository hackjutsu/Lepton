import { UPDATE_LOGIN_STATUS } from '../actions'

const DEFAULT_LOGIN_STATUS = {
  message: '',
  level: 'info',
  logFilePath: null
}

export default function (state = DEFAULT_LOGIN_STATUS, action) {
  switch (action.type) {
    case UPDATE_LOGIN_STATUS:
      return Object.assign({}, DEFAULT_LOGIN_STATUS, action.payload || {})
    default:
  }

  return state
}
