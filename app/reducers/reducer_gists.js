'use strict'

export default function (state = {}, action) {
  // console.log('reducer_gists is triggered with action type: ' + action.type)
  switch (action.type) {
    case 'GISTS_UPDATED':
      return action.payload
    case 'UPDATE_SINGLE_GIST':
      let newState = Object.assign(state, action.payload)
      return newState
    default:
  }
  return state
}
