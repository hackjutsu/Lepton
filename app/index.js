'use strict'

import fs from 'fs'
import { remote, ipcRenderer } from 'electron'
import React from 'react'
import ReactDom from 'react-dom'
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import electronLocalStorage from 'electron-json-storage-sync'

import './utilities/vendor/bootstrap/css/bootstrap.css'
import AppContainer from './containers/appContainer'
import HumanReadableTime from 'human-readable-time'
import ImageDownloader from 'image-downloader'
import SearchIndex from './utilities/search'
import Store from './utilities/store'
import {
  addLangPrefix as Prefixed,
  parseCustomTags,
  descriptionParser } from './utilities/parser'

import {
  getGitHubApi,
  GET_ALL_GISTS,
  GET_USER_PROFILE,
  EXCHANGE_ACCESS_TOKEN } from './utilities/githubApi'

import RootReducer from './reducers'
import {
  updateGists,
  updateSyncTime,
  updateGistTags,
  selectGistTag,
  updateAccessToken,
  updateUserSession,
  fetchSingleGist,
  selectGist,
  updateAuthWindowStatus,
  updateGistSyncStatus,
  updateSearchWindowStatus,
  updateUpdateAvailableBarStatus,
  updateNewVersionInfo,
  updateImmersiveModeStatus,
  updateAboutModalStatus,
  updateDashboardModalStatus,
  updatePinnedTags
} from './actions/index'

import Notifier from './utilities/notifier'

const logger = remote.getGlobal('logger')

let Account = null
try {
  Account = require('../configs/account')
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e
  Account = require('../configs/accountDummy')
}

// First instantiate the class
const localPref = new Store({
  // We'll call our data file 'user-preferences'
  configName: 'user-preferences',
  defaults: {}
})

const CONFIG_OPTIONS = {
  client_id: Account.client_id,
  client_secret: Account.client_secret,
  scopes: ['gist']
}

let preSyncSnapshot = {
  activeGistTag: null,
  activeGist: null
}

function launchAuthWindow (token) {
  logger.debug(`-----> Inside launchAuthWindow with token ${token}`)
  if (token) {
    logger.debug('-----> calling initUserSession with cached token ' + token)
    initUserSession(token)
    return
  }

  const webPreferences = {
    nodeIntegration: false
  }

  let authWindow = new remote.BrowserWindow({
    parent: remote.getGlobal('mainWindow'),
    width: 400,
    height: 600,
    show: false,
    webPreferences })
  let githubUrl = 'https://github.com/login/oauth/authorize?'
  let authUrl = githubUrl + 'client_id=' + CONFIG_OPTIONS.client_id + '&scope=' + CONFIG_OPTIONS.scopes
  logger.debug('loading authUrl' + authUrl)
  authWindow.loadURL(authUrl)
  authWindow.show()

  updateAuthWindowStatusOn()

  function handleCallback (url) {
    let rawCode = /code=([^&]*)/.exec(url) || null
    let code = (rawCode && rawCode.length > 1) ? rawCode[1] : null
    let error = /\?error=(.+)$/.exec(url)

    if (code || error) {
      // Close the browser if code found or error
      authWindow.webContents.session.clearStorageData([], () => {})
      authWindow.destroy()
      updateAuthWindowStatusOff()
    }

    // If there is a code, proceed to get token from github
    if (code) {
      logger.info('[Dispatch] updateUserSession IN_PROGRESS')
      reduxStore.dispatch(updateUserSession({ activeStatus: 'IN_PROGRESS' }))

      getGitHubApi(EXCHANGE_ACCESS_TOKEN)(
        CONFIG_OPTIONS.client_id, CONFIG_OPTIONS.client_secret, code)
        .then((payload) => {
          logger.debug('-----> calling initUserSession with new token ' + payload.access_token)
          return initUserSession(payload.access_token)
        })
        .catch((err) => {
          logger.error('Failed: ' + JSON.stringify(err.error))
          Notifier('Sync failed', 'Please check your network condition. 03')
        })
    } else if (error) {
      logger.error('Oops! Something went wrong and we couldn\'t' +
        'log you in using Github. Please try again.')
    }
  }

  // Handle the response from GitHub - See Update from 4/12/2015
  authWindow.webContents.on('will-navigate', (event, url) => {
    handleCallback(url)
  })

  authWindow.webContents.on('did-get-redirect-request', (event, oldUrl, newUrl) => {
    handleCallback(newUrl)
  })

  // Reset the authWindow on close
  authWindow.on('close', () => {
    updateAuthWindowStatusOff()
    authWindow = null
  }, false)
}

function setSyncTime (time) {
  logger.info('[Dispatch] updateSyncTime')
  reduxStore.dispatch(updateSyncTime(time))
}

function initAccessToken (token) {
  logger.info('[Dispatch] updateAccessToken')
  reduxStore.dispatch(updateAccessToken(token))
}

function updateAuthWindowStatusOn () {
  logger.info('[Dispatch] updateAuthWindowStatus ON')
  reduxStore.dispatch(updateAuthWindowStatus('ON'))
}

function updateAuthWindowStatusOff () {
  logger.info('[Dispatch] updateAuthWindowStatus OFF')
  reduxStore.dispatch(updateAuthWindowStatus('OFF'))
}

/** Start: Language tags management **/
function updateGistTagsAfterSync (gistTags) {
  logger.info('[Dispatch] updateGistTags')
  reduxStore.dispatch(updateGistTags(gistTags))
}
/** End: Language tags management **/

/** Start: Acitive language tag management **/
function getEffectiveActiveGistTagAfterSync (gistTags, newActiveTag) {
  // The active language tag could be invalid if the specific language tag no
  // long exists after synchronization. However, if it is still valid, we should
  // keep it.
  if (!gistTags || !gistTags[preSyncSnapshot.activeGistTag]) {
    return newActiveTag
  }
  return preSyncSnapshot.activeGistTag
}

function updateActiveGistTagAfterSync (gistTags, newActiveTagCandidate) {
  // The active language tag could be invalid if the specific language tag no
  // long exists after synchronization. We should get the effective active tag
  // by calling getEffectiveActiveGistTagAfterSync()
  let effectiveGistTag = getEffectiveActiveGistTagAfterSync(gistTags, newActiveTagCandidate)
  if (effectiveGistTag !== preSyncSnapshot.activeGistTag) {
    logger.info('[Dispatch] selectGistTag')
    reduxStore.dispatch(selectGistTag(newActiveTagCandidate))
  }
}
/** End: Acitive language tag management **/

/** Start: Acitive gist management **/
function updateActiveGistBase (gists, activeGist) {
  if (!gists || !activeGist) {
    // user has no gists
    return
  }

  if (!gists[activeGist].details) {
    logger.info('[Dispatch] fetchSingleGist ' + activeGist)
    reduxStore.dispatch(fetchSingleGist(gists[activeGist], activeGist))
  }
  logger.info('[Dispatch] selectGist ' + activeGist)
  reduxStore.dispatch(selectGist(activeGist))
}

function updateActiveGistAfterSync (gists, gistTags, newActiveTagCandidate) {
  let activeGist = preSyncSnapshot.activeGist
  if (!activeGist || !gists[activeGist]) {
    // If the previous active gist is not set or is deleted, we should reset it.
    let effectiveGistTag = getEffectiveActiveGistTagAfterSync(gistTags, newActiveTagCandidate)
    let gistListForActiveGistTag = gistTags[effectiveGistTag]
    activeGist = gistListForActiveGistTag[0] // reset the active gist
  }
  updateActiveGistBase(gists, activeGist)
}

function updateActiveGistAfterClicked (gists, gistTags, newActiveTag) {
  let gistListForActiveGistTag = gistTags[newActiveTag]
  let activeGist = gistListForActiveGistTag[0] // reset the active gist
  updateActiveGistBase(gists, activeGist)
}
/** End: Acitive gist management **/

/** Start: User gists management **/
function updateGistStoreAfterSync (gists) {
  logger.info('[Dispatch] updateGists')
  reduxStore.dispatch(updateGists(gists))
}

function takeSyncSnapshot () {
  let state = reduxStore.getState()
  preSyncSnapshot = {
    activeGistTag: state.activeGistTag,
    activeGist: state.activeGist
  }
}

function clearSyncSnapshot () {
  preSyncSnapshot = {
    activeGistTag: Prefixed('All'),
    activeGist: null
  }
}

function reSyncUserGists () {
  let { userSession, accessToken } = reduxStore.getState()
  updateUserGists(userSession.profile.login, accessToken)
}

function updateUserGists (userLoginId, token) {
  reduxStore.dispatch(updateGistSyncStatus('IN_PROGRESS'))
  return getGitHubApi(GET_ALL_GISTS)(token, userLoginId)
    .then((gistList) => {
      let preGists = reduxStore.getState().gists
      let gists = {}
      let rawGistTags = {}
      let activeTagCandidate = Prefixed('All')
      rawGistTags[Prefixed('All')] = new Set()
      let gistTags = {}
      let fuseSearchIndex = []

      gistList.forEach((gist) => {
        let langs = new Set()
        let filenameRecords = ''

        Object.keys(gist.files).forEach(filename => {
          // leave a space in between to help tokenization
          filenameRecords += ', ' + filename
          let file = gist.files[filename]
          let language = file.language || 'Other'
          langs.add(language)
          rawGistTags[Prefixed('All')].add(gist.id)

          // update the language tags
          let prefixedLang = Prefixed(language)
          if (rawGistTags.hasOwnProperty(prefixedLang)) {
            rawGistTags[prefixedLang].add(gist.id)
          } else {
            rawGistTags[prefixedLang] = new Set()
            rawGistTags[prefixedLang].add(gist.id)
          }

          // update the custom tags
          let customTags = parseCustomTags(descriptionParser(gist.description).customTags)
          customTags.forEach(tag => {
            if (rawGistTags.hasOwnProperty(tag)) {
              rawGistTags[tag].add(gist.id)
            } else {
              rawGistTags[tag] = new Set()
              rawGistTags[tag].add(gist.id)
            }
          })
        })

        gists[gist.id] = {
          langs: langs,
          brief: gist,
          details: null
        }

        // Keep the date for the unchanged gist, so that user doesn't need
        // to resync.
        let preGist = preGists[gist.id]
        if (preGist && preGist.details && preGist.details.updated_at === gist.updated_at) {
          gists[gist.id] = Object.assign(gists[gist.id], { details: preGist.details })
        }

        let langSearchRecords = ''
        langs.forEach(lang => {
          langSearchRecords += ',' + lang
        })

        // Update the SearchIndex
        fuseSearchIndex.push({
          id: gist.id,
          description: gist.description,
          language: langSearchRecords,
          filename: filenameRecords
        })
      }) // gistList.forEach

      SearchIndex.resetFuseIndex(fuseSearchIndex)

      for (let language in rawGistTags) {
        // Save the gist ids in an Array rather than a Set, which facilitate
        // many operations later, like displaying the gist id from an Array
        gistTags[language] = [...rawGistTags[language]]
      }

      // take the state snapshot at this moment
      takeSyncSnapshot()

      // refresh the redux state
      let humanReadableSyncTime = HumanReadableTime(new Date())
      setSyncTime(humanReadableSyncTime)
      updateGistStoreAfterSync(gists)
      updateGistTagsAfterSync(gistTags)
      updateActiveGistTagAfterSync(gistTags, activeTagCandidate)
      updateActiveGistAfterSync(gists, gistTags, activeTagCandidate)

      // clean up the snapshot for the previous state
      clearSyncSnapshot()

      Notifier('Sync succeeds', humanReadableSyncTime)
      reduxStore.dispatch(updateGistSyncStatus('DONE'))
    })
    .catch(err => {
      Notifier('Sync failed', 'Please check your network condition. 04')
      logger.error('The request has failed: ' + err)
      reduxStore.dispatch(updateGistSyncStatus('DONE'))
      throw err
    })
}
/** End: User gists management **/

/** Start: User session management **/
function initUserSession (token) {
  logger.debug(`-----> Inside initUserSession with access token ${token}`)
  reduxStore.dispatch(updateUserSession({ activeStatus: 'IN_PROGRESS' }))
  initAccessToken(token)
  let newProfile = null
  getGitHubApi(GET_USER_PROFILE)(token)
    .then((profile) => {
      logger.debug('-----> from GET_USER_PROFILE with profile ' + JSON.stringify(profile))
      newProfile = profile
      return updateUserGists(profile.login, token)
    })
    .then(() => {
      logger.debug('-----> before updateLocalStorage')
      updateLocalStorage({
        token: token,
        profile: newProfile.login,
        image: newProfile.avatar_url
      })
      logger.debug('-----> after updateLocalStorage')

      logger.debug('-----> before syncLocalPref')
      syncLocalPref(newProfile.login)
      logger.debug('-----> after syncLocalPref')

      remote.getCurrentWindow().setTitle(`${ newProfile.login } | Lepton`) // update the app title

      logger.info('[Dispatch] updateUserSession ACTIVE')
      reduxStore.dispatch(updateUserSession({ activeStatus: 'ACTIVE', profile: newProfile }))
    })
    .catch((err) => {
      logger.debug('-----> Failure with ' + JSON.stringify(err))
      logger.error('The request has failed: \n' + JSON.stringify(err))

      if (err.statusCode === 401) {
        logger.info('[Dispatch] updateUserSession EXPIRED')
        reduxStore.dispatch(updateUserSession({ activeStatus: 'EXPIRED' }))
      } else {
        logger.info('[Dispatch] updateUserSession INACTIVE')
        reduxStore.dispatch(updateUserSession({ activeStatus: 'INACTIVE' }))
      }
      Notifier('Sync failed', 'Please check your network condition. 00')
    })
}
/** End: User session management **/

/** Start: Local storage management **/
function updateLocalStorage (data) {
  try {
    logger.debug(`-----> Caching token ${data.token}`)
    let rst = electronLocalStorage.set('token', data.token)
    logger.debug(`-----> [${rst.status}] Cached token ${data.token}`)

    logger.debug(`-----> Caching profile ${data.profile}`)
    rst = electronLocalStorage.set('profile', data.profile)
    logger.debug(`-----> [${rst.status}] Cached profile ${data.profile}`)

    logger.debug(`-----> Caching image ${data.image}`)
    downloadImage(data.image, data.profile)

    logger.debug(`-----> User info is cached.`)
  } catch (e) {
    logger.error(`-----> Failed to cache user info. ${JSON.stringify(e)}`)
  }
}

function downloadImage (imageUrl, filename) {
  if (!imageUrl) {
    logger.debug(`-----> imageUrl is null`)
    return
  }

  const userProfilePath = (remote.app).getPath('userData') + '/profile/'
  if (!fs.existsSync(userProfilePath)) {
    fs.mkdirSync(userProfilePath)
  }

  let imagePath = userProfilePath + filename + '.png'
  ImageDownloader({
    url: imageUrl,
    dest: imagePath,
    done: (err, filename, image) => {
      if (err) {
        logger.error(err)
        return
      }

      const rst = electronLocalStorage.set('image', imagePath)
      logger.debug(`-----> [${rst.status}] Cached image ${imagePath}`)
    },
  })
}

function getCachedUserInfo () {
  logger.debug('-----> Inside getCachedUserInfo')
  const cachedProfile = electronLocalStorage.get('profile')
  logger.debug(`-----> [${cachedProfile.status}] cachedProfile is ${cachedProfile.data}`)
  const cachedToken = electronLocalStorage.get('token')
  logger.debug(`-----> [${cachedToken.status}] cachedToken is ${cachedToken.data}`)

  if (cachedProfile.status && cachedToken.status) {
    return {
      token: cachedToken.data,
      profile: cachedProfile.data,
      image: electronLocalStorage.get('image').data
    }
  }

  return null
}

function syncLocalPref (userName) {
  logger.debug(`-----> Inside syncLocalPref with userName ${userName}`)
  let pinnedTags = []
  if (localPref && localPref.get(userName) && localPref.get(userName).pinnedTags) {
    pinnedTags = localPref.get(userName).pinnedTags
  }

  logger.debug(`-----> pinnedTags are ${JSON.stringify(pinnedTags)}`)
  logger.info('[Dispatch] updatePinnedTags')
  reduxStore.dispatch(updatePinnedTags(pinnedTags))
}
/** End: Local storage management **/

/** Start: Response to main process events **/
function allDialogsClosed (dialogs) {
  let status = true
  dialogs.forEach(dialog => {
    if (dialog !== 'OFF') status = false
  })
  return status
}

ipcRenderer.on('search-gist', data => {
  const state = reduxStore.getState()
  const {
    immersiveMode,
    gistRawModal,
    searchWindowStatus,
    gistEditModalStatus,
    gistNewModalStatus,
    aboutModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    immersiveMode,
    gistRawModal.status,
    gistEditModalStatus,
    gistNewModalStatus,
    aboutModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus ]
  if (allDialogsClosed(dialogs)) {
    const preStatus = searchWindowStatus
    const newStatus = preStatus === 'ON' ? 'OFF' : 'ON'
    reduxStore.dispatch(updateSearchWindowStatus(newStatus))
  }
})

ipcRenderer.on('dashboard', data => {
  const state = reduxStore.getState()
  const {
    immersiveMode,
    gistRawModal,
    searchWindowStatus,
    aboutModalStatus,
    dashboardModalStatus,
    gistEditModalStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    aboutModalStatus,
    immersiveMode,
    gistRawModal.status,
    gistEditModalStatus,
    searchWindowStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus ]
  if (allDialogsClosed(dialogs)) {
    const preStatus = dashboardModalStatus
    const newStatus = preStatus === 'ON' ? 'OFF' : 'ON'
    reduxStore.dispatch(updateDashboardModalStatus(newStatus))
  }
})

ipcRenderer.on('about-page', data => {
  const state = reduxStore.getState()
  const {
    immersiveMode,
    gistRawModal,
    searchWindowStatus,
    aboutModalStatus,
    gistEditModalStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    immersiveMode,
    gistRawModal.status,
    gistEditModalStatus,
    searchWindowStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus ]
  if (allDialogsClosed(dialogs)) {
    const preStatus = aboutModalStatus
    const newStatus = preStatus === 'ON' ? 'OFF' : 'ON'
    reduxStore.dispatch(updateAboutModalStatus(newStatus))
  }
})

ipcRenderer.on('new-gist', data => {
  const state = reduxStore.getState()
  const {
    immersiveMode,
    gistRawModal,
    searchWindowStatus,
    aboutModalStatus,
    gistNewModalStatus,
    gistEditModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    immersiveMode,
    gistRawModal.status,
    searchWindowStatus,
    aboutModalStatus,
    gistNewModalStatus,
    gistEditModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus ]
  if (allDialogsClosed(dialogs)) {
    ipcRenderer.emit('new-gist-renderer')
  }
})

ipcRenderer.on('edit-gist', data => {
  const state = reduxStore.getState()
  const {
    gistRawModal,
    searchWindowStatus,
    aboutModalStatus,
    gistNewModalStatus,
    gistEditModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    gistRawModal.status,
    gistNewModalStatus,
    gistEditModalStatus,
    searchWindowStatus,
    aboutModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus ]
  if (allDialogsClosed(dialogs)) {
    ipcRenderer.emit('edit-gist-renderer')
  }
})

ipcRenderer.on('immersive-mode', data => {
  const state = reduxStore.getState()
  const {
    searchWindowStatus,
    aboutModalStatus,
    immersiveMode,
    gistRawModal,
    gistEditModalStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus } = state

  const dialogs = [
    searchWindowStatus,
    aboutModalStatus,
    gistRawModal.status,
    gistEditModalStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus ]
  if (allDialogsClosed(dialogs)) {
    const preStatus = immersiveMode
    const newStatus = preStatus === 'ON' ? 'OFF' : 'ON'
    reduxStore.dispatch(updateImmersiveModeStatus(newStatus))
  }
})

ipcRenderer.on('back-to-normal-mode', data => {
  const state = reduxStore.getState()
  const { gistRawModal, gistEditModalStatus } = state

  const dialogs = [gistRawModal.status, gistEditModalStatus]
  if (allDialogsClosed(dialogs)) {
    reduxStore.dispatch(updateImmersiveModeStatus('OFF'))
  }
  reduxStore.dispatch(updateAboutModalStatus('OFF'))
})

ipcRenderer.on('update-available', payload => {
  const newVersionInfo = remote.getGlobal('newVersionInfo')
  if (electronLocalStorage.get('skipped-version').data === newVersionInfo.version) return

  reduxStore.dispatch(updateNewVersionInfo(newVersionInfo))
  reduxStore.dispatch(updateUpdateAvailableBarStatus('ON'))
})
/** End: Response to  main process events **/

// Start
const reduxStore = createStore(
  RootReducer,
  applyMiddleware(thunk)
)

ReactDom.render(
  <Provider store={ reduxStore }>
    <AppContainer
      searchIndex = { SearchIndex }
      localPref = { localPref }
      updateLocalStorage = { updateLocalStorage }
      loggedInUserInfo = { getCachedUserInfo() }
      launchAuthWindow = { launchAuthWindow }
      reSyncUserGists = { reSyncUserGists }
      updateAboutModalStatus = { updateAboutModalStatus }
      updateDashboardModalStatus = { updateDashboardModalStatus }
      updateActiveGistAfterClicked = { updateActiveGistAfterClicked } />
  </Provider>,
  document.getElementById('container')
)
