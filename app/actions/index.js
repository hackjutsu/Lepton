'use strict'

import ReqPromise from 'request-promise'

const SINGLE_GIST_URI = 'https://api.github.com/gists/'
function makeOption (uri) {
  return {
    uri: uri,
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  }
}

export const UPDATE_ACCESS_TOKEN = 'UPDATE_ACCESS_TOKEN'
export const UPDATE_GISTS = 'UPDATE_GISTS'
export const UPDATE_SINGLE_GIST = 'UPDATE_SINGLE_GIST'
export const UPDATE_LANG_TAGS = 'UPDATE_LANG_TAGS'
export const SELECT_LANG_TAG = 'SELECT_LANG_TAG'
export const SELECT_GIST = 'SELECT_GIST'

export function updateAccessToken (token) {
  return {
    type: UPDATE_ACCESS_TOKEN,
    payload: token
  }
}

export function updateGists (gists) {
  return {
    type: UPDATE_GISTS,
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
    type: UPDATE_LANG_TAGS,
    payload: tags
  }
}

export function selectLangTag (tag) {
  return {
    type: SELECT_LANG_TAG,
    payload: tag
  }
}

export function selectGist (id) {
  return {
    type: SELECT_GIST,
    payload: id
  }
}

export function fetchSingleGist (oldGist, id) {
  console.log(SINGLE_GIST_URI + id)
  return (dispatch, getState) => {
    let state = getState()
    return ReqPromise(makeOption(SINGLE_GIST_URI + id + '?access_token=' + state.accessToken))
      .then((details) => {
        let newGist = Object.assign(oldGist, { details: details })
        let newGistWithId = {}
        newGistWithId[id] = newGist
        dispatch(updateSingleGist(newGistWithId))
      })
      .catch((err) => {
        console.log('The request has failed: ' + err)
      })
  }
}
