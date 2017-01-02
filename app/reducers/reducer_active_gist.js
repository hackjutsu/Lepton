'use strict'

export default function (state = null, action) {
  // console.log('reducer_active_lang_tag is triggered with action type: ' + action.type)
  switch (action.type) {
    case 'GIST_SELECTED':
      return action.payload
    default:
  }

  return state
}
