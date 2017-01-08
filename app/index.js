'use strict'

import { remote } from 'electron'
import React from 'react'
import ReactDom from 'react-dom'
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import ReqPromise from 'request-promise'
import AppContainer from './containers/appContainer'
import Account from '../configs/account'
import HumanReadableTime from 'human-readable-time'
import RootReducer from './reducers'
import {
  updateGists,
  updateSyncTime,
  updateLangTags,
  selectLangTag,
  updateAccessToken,
  updateUserSession,
  fetchSingleGist,
  selectGist
} from './actions/index'
import './lib/vendor/bootstrap/css/bootstrap.css'

const USER_PROFILE_URI = 'https://api.github.com/user'
const CONFIG_OPTIONS = {
  client_id: Account.client_id,
  client_secret: Account.client_secret,
  scopes: ['user', 'gist']
}

let preSyncSnapshot = {
  activeLangTag: null,
  activeGist: null
}

function makeOption (uri, accessToken) {
  return {
    uri: uri,
    headers: {
      'User-Agent': 'Request-Promise',
    },
    qs: {
      access_token: accessToken
    },
    json: true // Automatically parses the JSON string in the response
  }
}

function launchAuthWindow (accessToken) {
  if (accessToken) {
    initUserSession(accessToken)
    return
  }

  let authWindow = new remote.BrowserWindow({ width: 400, height: 600, show: false })
  let githubUrl = 'https://github.com/login/oauth/authorize?'
  let authUrl = githubUrl + 'client_id=' + CONFIG_OPTIONS.client_id + '&scope=' + CONFIG_OPTIONS.scopes
  authWindow.loadURL(authUrl)
  authWindow.show()

  function handleCallback (url) {
    let rawCode = /code=([^&]*)/.exec(url) || null
    let code = (rawCode && rawCode.length > 1) ? rawCode[1] : null
    let error = /\?error=(.+)$/.exec(url)

    if (code || error) {
      // Close the browser if code found or error
      console.log('** Clear the session and destroy the auth browser')
      authWindow.webContents.session.clearStorageData([], () => {})
      authWindow.destroy()
    }

    // If there is a code, proceed to get token from github
    if (code) {
      let accessTokenPromise = requestGithubToken(code)
      accessTokenPromise.then((response) => {
        let accessToken = response.access_token
        console.log('Got access Token: ' + accessToken)
        initUserSession(accessToken)
      }).catch((err) => {
        console.log('Failed: ' + JSON.stringify(err.error))
      })
    } else if (error) {
      alert('Oops! Something went wrong and we couldn\'t' +
        'log you in using Github. Please try again.')
    }
  }

  function requestGithubToken (code) {
    return ReqPromise({
      method: 'POST',
      uri: 'https://github.com/login/oauth/access_token',
      form: {
        'client_id': CONFIG_OPTIONS.client_id,
        'client_secret': CONFIG_OPTIONS.client_secret,
        'code': code,
      },
      json: true
    })
  }

  // Handle the response from GitHub - See Update from 4/12/2015
  authWindow.webContents.on('will-navigate', function (event, url) {
    console.log('** Inside on will-navigate')
    handleCallback(url)
  })

  authWindow.webContents.on('did-get-redirect-request', function (event, oldUrl, newUrl) {
    console.log('** Inside did-get-redirect-request')
    handleCallback(newUrl)
  })

  // Reset the authWindow on close
  authWindow.on('close', function () {
    authWindow = null
  }, false)
}

function setSyncTime (time) {
  console.log('** dispatch updateSyncTime')
  reduxStore.dispatch(updateSyncTime(time))
}

function initAccessToken (token) {
  console.log('** dispatch updateAccessToken')
  reduxStore.dispatch(updateAccessToken(token))
}

/** Start: Language tags management **/
function updateLangTagsAfterSync (langTags) {
  console.log('** dispatch updateLangTags')
  reduxStore.dispatch(updateLangTags(langTags))
}
/** End: Language tags management **/

/** Start: Acitive language tag management **/
function getEffectiveActiveLangTagAfterSync (langTags, newActiveTag) {
  // The active language tag could be invalid if the specific language tag no
  // long exists after synchronization. However, if it is still valid, we should
  // keep it.
  if (!langTags || !langTags[preSyncSnapshot.activeLangTag]) {
    return newActiveTag
  }
  return preSyncSnapshot.activeLangTag
}

function updateActiveLangTagAfterSync (langTags, newActiveTagCandidate) {
  // The active language tag could be invalid if the specific language tag no
  // long exists after synchronization. We should get the effective active tag
  // by calling getEffectiveActiveLangTagAfterSync()
  let effectiveLangTag = getEffectiveActiveLangTagAfterSync(langTags, newActiveTagCandidate)
  if (effectiveLangTag !== preSyncSnapshot.activeLangTag) {
    console.log('** dispatch selectLangTag')
    reduxStore.dispatch(selectLangTag(newActiveTagCandidate))
  }
}
/** End: Acitive language tag management **/

/** Start: Acitive gist management **/
function updateActiveGistBase (gists, activeGist) {
  if (!gists[activeGist].details) {
    console.log('** dispatch fetchSingleGist')
    reduxStore.dispatch(fetchSingleGist(gists[activeGist], activeGist))
  }
  console.log('** dispatch selectGist')
  reduxStore.dispatch(selectGist(activeGist))
}

function updateActiveGistAfterSync (gists, langTags, newActiveTagCandidate) {
  let activeGist = preSyncSnapshot.activeGist
  if (!activeGist || !gists[activeGist]) {
    // If the previous active gist is not set or is deleted, we should reset it.
    let effectiveLangTag = getEffectiveActiveLangTagAfterSync(langTags, newActiveTagCandidate)
    let gistListForActiveLangTag = [...langTags[effectiveLangTag]]
    activeGist = gistListForActiveLangTag[0] // reset the active gist
  }
  updateActiveGistBase(gists, activeGist)
}

function updateActiveGistAfterClicked (gists, langTags, newActiveTag) {
  let gistListForActiveLangTag = [...langTags[newActiveTag]]
  let activeGist = gistListForActiveLangTag[0] // reset the active gist
  updateActiveGistBase(gists, activeGist)
}
/** End: Acitive gist management **/

/** Start: User gists management **/
function updateGistStoreAfterSync (gists) {
  console.log('** dispatch updateGists')
  reduxStore.dispatch(updateGists(gists))
}

function makeUserGistsUri (userLoginId) {
  return 'https://api.github.com/users/' + userLoginId + '/gists'
}

function reSyncUserGists () {
  let state = reduxStore.getState()
  preSyncSnapshot = {
    activeLangTag: state.activeLangTag,
    activeGist: state.activeGist
  }
  updateUserGists(state.userSession.profile.login, state.accessToken)
}

function updateUserGists (userLoginId, accessToken) {
  return ReqPromise(makeOption(makeUserGistsUri(userLoginId), accessToken))
    .then((gistList) => {
      console.log('The length of the gist list is ' + gistList.length)
      let gists = {}
      let langTags = {}
      let activeTagCandidate = 'All'
      langTags.All = new Set()

      gistList.forEach((gist) => {
        let langs = new Set()

        for (let key in gist.files) {
          if (gist.files.hasOwnProperty(key)) {
            let file = gist.files[key]
            let language = file.language
            langs.add(language)
            langTags.All.add(gist.id)
            if (langTags.hasOwnProperty(language)) {
              langTags[language].add(gist.id)
            } else {
              langTags[language] = new Set()
              langTags[language].add(gist.id)
            }
          }
        }

        gists[gist.id] = {
          langs: langs,
          brief: gist,
          details: null
        }
        console.log('~~ updated gist with id ' + gist.id)
      }) // gistList.forEach

      // refresh the redux state
      setSyncTime(HumanReadableTime(new Date()))
      updateGistStoreAfterSync(gists)
      updateLangTagsAfterSync(langTags)
      updateActiveLangTagAfterSync(langTags, activeTagCandidate)
      updateActiveGistAfterSync(gists, langTags, activeTagCandidate)

      // clean up the snapshot for the previous state
      preSyncSnapshot.activeLangTag = null
      preSyncSnapshot.activeGist = null
    })
    .catch(function (err) {
      console.log('The request has failed: ' + err)
    })
}
/** End: User gists management **/

/** Start: User session management **/
function initUserSession (accessToken) {
  initAccessToken(accessToken)
  ReqPromise(makeOption(USER_PROFILE_URI, accessToken))
    .then((profile) => {
      updateUserGists(profile.login, accessToken).then(() => {
        console.log('** dispatch updateUserSession')
        reduxStore.dispatch(updateUserSession({ active: 'true', profile: profile }))
        updateLocalStorage({
          token: accessToken,
          profile: profile.login,
          image: profile.avatar_url
        })
      })
    })
  .catch((err) => {
    console.log('The request has failed: ' + err)
  })
}
/** End: User session management **/

function updateLocalStorage (localData) {
  localStorage.set('token', localData.token)
  localStorage.set('profile', localData.profile)

  if (localData.image) {
    localStorage.downloadImage(localData.image, localData.profile)
  }
}

const path = require('path')
const LocalStore = require('./store/store.js')
const localStorage = new LocalStore({
  // We'll call our data file 'user-preferences'
  configName: 'user-profiles',
  defaults: {
    token: null,
    profile: null
  }
})

function getLoggedInUserInfo () {
  console.log('Hello')
  let loggedInUserProfile = localStorage.get('profile')
  let loggedInUserToken = localStorage.get('token')
  if (loggedInUserProfile && loggedInUserToken) {
    console.log('!! the logged in user is ' + loggedInUserProfile)
    console.log('!! the logged in user token is ' + loggedInUserToken)
    return {
      token: loggedInUserToken,
      profile: loggedInUserProfile,
      image: localStorage.get('image')
    }
  }

  console.log('World')

  return null
}

// Start
const reduxStore = createStore(
    RootReducer,
    applyMiddleware(thunk)
)

ReactDom.render(
  <Provider store={ reduxStore }>
    <AppContainer
      updateLocalStorage = { updateLocalStorage }
      getLoggedInUserInfo = { getLoggedInUserInfo }
      launchAuthWindow = { launchAuthWindow }
      reSyncUserGists = { reSyncUserGists }
      updateActiveGistAfterClicked = { updateActiveGistAfterClicked } />
  </Provider>,
  document.getElementById('container')
)
