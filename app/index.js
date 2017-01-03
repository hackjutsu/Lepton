'use strict'

import { remote } from 'electron'
import React from 'react'
import ReactDom from 'react-dom'
import { Provider } from 'react-redux'
import ReqPromise from 'request-promise'
import AppContainer from './containers/appContainer'

import Account from '../configs/account'

const USER_GISTS_URI = 'https://api.github.com/users/hackjutsu/gists'
const USER_PROFILE_URI = 'https://api.github.com/user'

// how to import action creators?
import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import RootReducer from './reducers'
import {
  updateGists,
  updateLangTags,
  selectLangTag,
  updateAccessToken,
  updateUserSession
} from './actions/index'

const store = createStore(
    RootReducer,
    applyMiddleware(thunk)
)

ReactDom.render(
  <Provider store={ store }>
    <AppContainer launchAuthWindow = { launchAuthWindow }/>
  </Provider>,
  document.getElementById('container')
)

let options = {
  client_id: Account.client_id,
  client_secret: Account.client_secret,
  scopes: ['user', 'gist']
}

function launchAuthWindow () {
  let authWindow = new remote.BrowserWindow({ width: 800, height: 600, show: false })
  let githubUrl = 'https://github.com/login/oauth/authorize?'
  let authUrl = githubUrl + 'client_id=' + options.client_id + '&scope=' + options.scopes
  authWindow.loadURL(authUrl)
  authWindow.show()

  function handleCallback (url) {
    let rawCode = /code=([^&]*)/.exec(url) || null
    let code = (rawCode && rawCode.length > 1) ? rawCode[1] : null
    let error = /\?error=(.+)$/.exec(url)

    if (code || error) {
      // Close the browser if code found or error
      console.log('** About to destroy the auth browser')
      authWindow.destroy()
    }

    // If there is a code, proceed to get token from github
    if (code) {
      console.log(code)
      let accessTokenPromise = requestGithubToken(options, code)
      accessTokenPromise.then((response) => {
        let accessToken = response.access_token
        console.log('Got access Token: ' + accessToken)
		initUserSession (accessToken)
      }).catch((err) => {
        console.log('Failed: ' + JSON.stringify(err.error))
      })
    } else if (error) {
      alert('Oops! Something went wrong and we couldn\'t' +
        'log you in using Github. Please try again.')
    }
  }

  function requestGithubToken (options, code) {
    return ReqPromise({
      method: 'POST',
      uri: 'https://github.com/login/oauth/access_token',
      form: {
        'client_id': options.client_id,
        'client_secret': options.client_secret,
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

function _updateAccessToken (token) {
  store.dispatch(updateAccessToken(token))
}

function _updateGistStore (gists) {
  store.dispatch(updateGists(gists))
}

function _updateLangTags (langsTags) {
  store.dispatch(updateLangTags(langsTags))
}

function _updateActiveLangTag (activeTag) {
  store.dispatch(selectLangTag(activeTag))
}

function _updateUserSession (accessToken) {
  ReqPromise(makeOption(USER_PROFILE_URI, accessToken))
    .then((data) => {
    //   console.log(JSON.stringify(data))
	  store.dispatch(updateUserSession({
		active : 'true',
        profile: data
	  }))
	})
	.catch((err) => {
      console.log('The request has failed: ' + err)
	})
}

function initUserSession (accessToken) {
  _updateAccessToken(accessToken)

  ReqPromise(makeOption(USER_GISTS_URI, accessToken))
  .then((gistList) => {
    console.log('The length of the gist list is ' + gistList.length)
    let gists = {}
    let langsTags = {}
    let activeTag = ''

    gistList.forEach((gist) => {
      let langs = new Set()

      for (let key in gist.files) {
        if (gist.files.hasOwnProperty(key)) {
          let file = gist.files[key]
          let language = file.language
          langs.add(language)
          if (langsTags.hasOwnProperty(language)) {
            langsTags[language].add(gist.id)
          } else {
            if (!activeTag) activeTag = language
            langsTags[language] = new Set()
            langsTags[language].add(gist.id)
          }
        }
      }

      gists[gist.id] = {
        langs: langs,
        brief: gist,
        details: null
      }
    }) // gistList.forEach

    // initialize the redux store
    _updateGistStore(gists)
    _updateLangTags(langsTags)
    _updateActiveLangTag(activeTag)
	_updateUserSession(accessToken)
  })
  .catch(function (err) {
    console.log('The request has failed: ' + err)
  })
}
