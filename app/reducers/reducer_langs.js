'use strict'

export default function (state = {}, action) {
  // console.log('** reducer_langs is triggered with action type: ' + action.type)
  switch (action.type) {
    case 'LANG_TAGS_UPDATED':
      return action.payload
    default:
  }

  return state
}
