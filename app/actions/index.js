'use strict'

import Account from '../../configs/account'
import ReqPromise from 'request-promise'
const SINGLE_GIST_URI = 'https://api.github.com/gists/'
function makeOption (uri) {
  return {
    uri: uri,
    headers: {
      'User-Agent': 'Request-Promise'
    },
    auth: { // HTTP Authentication
      user: Account.username,
      pass: Account.password
    },
    json: true // Automatically parses the JSON string in the response
  }
}

export const GISTS_UPDATED = 'GISTS_UPDATED'
export const UPDATE_SINGLE_GIST = 'UPDATE_SINGLE_GIST'
export const LANG_TAGS_UPDATED = 'LANG_TAGS_UPDATED'
export const LANG_TAG_SELECTED = 'LANG_TAG_SELECTED'
export const GIST_SELECTED = 'GIST_SELECTED'

export function updateGists (gists) {
  return {
    type: GISTS_UPDATED,
    payload: gists
  }
}

export function updateSingleGist (gist) {
  console.log('** Inside updateSingleGist')
  return {
    type: UPDATE_SINGLE_GIST,
    payload: gist
  }
}

export function updateLangTags (tags) {
  return {
    type: LANG_TAGS_UPDATED,
    payload: tags
  }
}

export function selectLangTag (tag) {
  return {
    type: LANG_TAG_SELECTED,
    payload: tag
  }
}

export function selectGist (id) {
  return {
    type: GIST_SELECTED,
    payload: id
  }
}

export function fetchSingleGist (oldGist, id) {
  console.log(SINGLE_GIST_URI + id)
  return (dispatch, getState) => {
    return ReqPromise(makeOption(SINGLE_GIST_URI + id))
      .then((details) => {
        let newGist = Object.assign(oldGist, { details: details })
        let newGistWithId = {}
        newGistWithId[id] = newGist
        dispatch(updateSingleGist(newGistWithId))
      })
      .catch(function (err) {
        console.log('The request has failed: ' + err)
      })
  }
}
