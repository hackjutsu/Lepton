'use strict'

import { UPDATE_ACCESS_TOKEN } from '../actions'

export default function (state = '', action) {
  switch (action.type) {
    case UPDATE_ACCESS_TOKEN:
      return action.payload
    default:
  }
  return state
}
