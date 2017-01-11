'use strict'

import { getGitHubApi, GET_SINGLE_GIST } from '../utilities/gitHubApi'
import { remote } from 'electron'
const logger = remote.getGlobal('logger')

export const UPDATE_USER_SESSION = 'UPDATE_USER_SESSION'
export const LOGOUT_USER_SESSION = 'LOGOUT_USER_SESSION'
export const UPDATE_ACCESS_TOKEN = 'UPDATE_ACCESS_TOKEN'
export const REMOVE_ACCESS_TOKEN = 'REMOVE_ACCESS_TOKEN'
export const UPDATE_GISTS = 'UPDATE_GISTS'
export const UPDATE_SYNC_TIME = 'UPDATE_SYNC_TIME'
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

export function removeAccessToken () {
  return {
    type: REMOVE_ACCESS_TOKEN,
    payload: null
  }
}

export function updateUserSession (session) {
  return {
    type: UPDATE_USER_SESSION,
    payload: session
  }
}

export function logoutUserSession () {
  return {
    type: LOGOUT_USER_SESSION,
    payload: null
  }
}

export function updateGists (gists) {
  return {
    type: UPDATE_GISTS,
    payload: gists
  }
}

export function updateSyncTime (time) {
  return {
    type: UPDATE_SYNC_TIME,
    payload: time
  }
}

export function updateSingleGist (gist) {
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
  return (dispatch, getState) => {
    let state = getState()
    return getGitHubApi(GET_SINGLE_GIST)(state.accessToken, id)
      .then((details) => {
        let newGist = Object.assign(oldGist, { details: details })
        let newGistWithId = {}
        newGistWithId[id] = newGist
        dispatch(updateSingleGist(newGistWithId))
      })
      .catch((err) => {
        logger.err('The request has failed: ' + err)
      })
  }
}
