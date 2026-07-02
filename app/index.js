import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import { Promise } from 'bluebird'
import { thunk } from 'redux-thunk'
import electronBridge from './utilities/electronBridge'

import './utilities/vendor/bootstrap/css/bootstrap.css'
import AppContainer from './containers/appContainer'
import HumanReadableTime from 'human-readable-time'
import SearchIndex from './utilities/search'
import Store from './utilities/store'
import { getRenderFixture } from './renderFixtures'
import {
  addLangPrefix as Prefixed,
  parseCustomTags,
  descriptionParser
} from './utilities/parser'

import {
  getGitHubApi,
  GET_ALL_GISTS,
  GET_SINGLE_GIST,
  GET_USER_PROFILE,
  EXCHANGE_ACCESS_TOKEN
} from './utilities/githubApi'

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
  updateLoginStatus,
  updateGistSyncStatus,
  updateSearchWindowStatus,
  updateUpdateAvailableBarStatus,
  updateNewVersionInfo,
  updateImmersiveModeStatus,
  updateGistEditModeStatus,
  updateGistNewModeStatus,
  updateAboutModalStatus,
  updateDashboardModalStatus,
  updatePinnedTags
} from './actions/index'

import { notifySuccess, notifyFailure } from './utilities/notifier'
import { configureI18n, t } from './utilities/i18n'
import { shouldDownloadAllSnippets } from './utilities/config'

const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger
const conf = electronBridge.config
configureI18n(electronBridge.config.get('i18n:locale'))

const Account = electronBridge.account.get()

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
const GIST_DETAIL_SYNC_CONCURRENCY = 5
const LOGIN_STATUS = {
  openingOAuthWindow: 'Opening OAuth...',
  waitingGitHubAuthorization: 'Awaiting auth...',
  receivedOAuthCode: 'Code received.',
  exchangingOAuthCode: 'Exchanging token...',
  accessTokenReceived: 'Loading profile...',
  loadingGitHubProfile: 'Loading profile...',
  syncingSnippetIndex: 'Syncing snippet index...',
  signInComplete: 'Signed in.',
  signInFailed: 'Sign-in failed.'
}

let preSyncSnapshot = {
  activeGistTag: null,
  activeGist: null
}

function getRenderFixtureName () {
  if (typeof window === 'undefined' || !window.location || !window.location.search) return null
  return new URLSearchParams(window.location.search).get('renderFixture')
}

function launchAuthWindow (token) {
  logger.debug('[auth] launchAuthWindow called ' + JSON.stringify({ hasCachedCredential: Boolean(token) }))
  if (token) {
    logger.debug('[auth] Starting session with cached credential')
    initUserSession(token)
    return
  }

  logger.debug('[auth] Starting GitHub OAuth login ' + JSON.stringify({
    hasClientId: Boolean(CONFIG_OPTIONS.client_id),
    clientIdLength: CONFIG_OPTIONS.client_id ? CONFIG_OPTIONS.client_id.length : 0,
    hasClientSecret: Boolean(CONFIG_OPTIONS.client_secret),
    scopeCount: CONFIG_OPTIONS.scopes.length
  }))

  updateAuthWindowStatusOn()
  updateLoginStatusInfo(LOGIN_STATUS.openingOAuthWindow)

  const gitHubLogin = electronBridge.auth.startGitHubLogin({
    clientId: CONFIG_OPTIONS.client_id,
    scopes: CONFIG_OPTIONS.scopes
  })

  updateLoginStatusInfo(LOGIN_STATUS.waitingGitHubAuthorization)

  gitHubLogin
    .then(handleAuthResult)
    .catch((err) => {
      updateAuthWindowStatusOff()
      updateLoginStatusFailure()
      logger.error('Failed to launch GitHub auth window: ' + describeGitHubLoginError(err))
      notifyFailure(t('notification.syncFailed'), t('notification.networkFailure', { code: '03' }))
    })
}

function handleAuthResult (result) {
  updateAuthWindowStatusOff()
  logger.debug('[auth] GitHub OAuth result received: ' + JSON.stringify(describeGitHubAuthResult(result)))

  if (!result || result.status === 'closed') {
    clearLoginStatus()
    return
  }

  if (result.status === 'success' && result.code) {
    logger.info('[Dispatch] updateUserSession IN_PROGRESS')
    reduxStore.dispatch(updateUserSession({ activeStatus: 'IN_PROGRESS' }))
    updateLoginStatusInfo(LOGIN_STATUS.receivedOAuthCode)

    logger.debug('[auth] Exchanging OAuth code for access credential ' + JSON.stringify({
      codeLength: result.code.length,
      hasClientId: Boolean(CONFIG_OPTIONS.client_id),
      hasClientSecret: Boolean(CONFIG_OPTIONS.client_secret)
    }))

    updateLoginStatusInfo(LOGIN_STATUS.exchangingOAuthCode)
    getGitHubApi(EXCHANGE_ACCESS_TOKEN)(
      CONFIG_OPTIONS.client_id, CONFIG_OPTIONS.client_secret, result.code)
      .then((payload) => {
        logger.debug('[auth] OAuth credential exchange succeeded ' + JSON.stringify({
          hasAccessCredential: Boolean(payload && payload.access_token),
          credentialType: payload && payload.token_type,
          scope: payload && payload.scope
        }))
        return initUserSession(payload.access_token, { freshOAuthToken: true })
      })
      .catch((err) => {
        reduxStore.dispatch(updateUserSession({ activeStatus: 'INACTIVE' }))
        updateLoginStatusFailure()
        logger.error('GitHub login failed: ' + describeGitHubLoginError(err))
        notifyFailure(t('notification.syncFailed'), t('notification.networkFailure', { code: '03' }))
      })
    return
  }

  updateLoginStatusFailure()
  logger.error('Oops! Something went wrong and we couldn\'t' +
    'log you in using Github. Please try again.')
}

function describeGitHubLoginError (err) {
  if (!err) return 'unknown error'

  const details = err.error || err.response || err
  if (details && typeof details === 'object') {
    return JSON.stringify({
      name: err.name,
      message: err.message,
      statusCode: err.statusCode || (err.response && err.response.statusCode),
      error: details.error || details.message,
      errorDescription: details.error_description || err.errorDescription,
      parseError: details.parseError,
      bodyPrefix: details.bodyPrefix
    })
  }

  return String(details)
}

function describeGitHubAuthResult (result) {
  if (!result || typeof result !== 'object') {
    return {
      status: 'unknown'
    }
  }

  return {
    status: result.status,
    hasCode: Boolean(result.code),
    codeLength: result.code ? result.code.length : undefined,
    error: result.error,
    errorDescription: result.errorDescription
  }
}

function describeGitHubProfile (profile) {
  if (!profile || typeof profile !== 'object') {
    return {
      hasProfile: false
    }
  }

  return {
    hasProfile: true,
    login: profile.login,
    id: profile.id,
    type: profile.type
  }
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

function updateLoginStatusInfo (message) {
  reduxStore.dispatch(updateLoginStatus({
    message,
    level: 'info',
    logFilePath: null
  }))
}

function updateSnippetDownloadStatus (downloaded, total) {
  const message = `Downloading snippets (${downloaded}/${total})`
  reduxStore.dispatch(updateLoginStatus({
    message,
    level: 'info',
    logFilePath: null
  }))
}

function updateLoginStatusFailure () {
  const logFilePath = getLogFilePath()
  reduxStore.dispatch(updateLoginStatus({
    message: LOGIN_STATUS.signInFailed,
    level: 'error',
    logFilePath
  }))
}

function clearLoginStatus () {
  reduxStore.dispatch(updateLoginStatus(null))
}

function getLogFilePath () {
  try {
    const paths = electronBridge.globals.getPaths()
    return paths && paths.logFilePath ? paths.logFilePath : null
  } catch (err) {
    logger.warn('Unable to read log file path for login status: ' + describeGitHubLoginError(err))
    return null
  }
}

/** Start: Language tags management **/
function updateGistTagsAfterSync (gistTags) {
  logger.info('[Dispatch] updateGistTags')
  reduxStore.dispatch(updateGistTags(gistTags))
}
/** End: Language tags management **/

/** Start: Active language tag management **/
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
  const effectiveGistTag = getEffectiveActiveGistTagAfterSync(gistTags, newActiveTagCandidate)
  if (effectiveGistTag !== preSyncSnapshot.activeGistTag) {
    logger.info('[Dispatch] selectGistTag')
    reduxStore.dispatch(selectGistTag(newActiveTagCandidate))
  }
}
/** End: Active language tag management **/

/** Start: Active gist management **/
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
    const effectiveGistTag = getEffectiveActiveGistTagAfterSync(gistTags, newActiveTagCandidate)
    const gistListForActiveGistTag = gistTags[effectiveGistTag]
    activeGist = gistListForActiveGistTag[0] // reset the active gist
  }
  updateActiveGistBase(gists, activeGist)
}

function updateActiveGistAfterClicked (gists, gistTags, newActiveTag) {
  const gistListForActiveGistTag = gistTags[newActiveTag]
  const activeGist = gistListForActiveGistTag[0] // reset the active gist
  updateActiveGistBase(gists, activeGist)
}
/** End: Active gist management **/

/** Start: User gists management **/
function updateGistStoreAfterSync (gists) {
  logger.info('[Dispatch] updateGists')
  reduxStore.dispatch(updateGists(gists))
}

function takeSyncSnapshot () {
  const state = reduxStore.getState()
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
  const { userSession, accessToken } = reduxStore.getState()
  updateUserGists(userSession.profile.login, accessToken)
}

function downloadGistDetailsAfterListSync (gistList, token) {
  if (!shouldDownloadAllSnippets(conf)) {
    return Promise.resolve({})
  }

  const total = gistList.length
  if (total === 0) {
    return Promise.resolve({})
  }

  let downloaded = 0
  updateSnippetDownloadStatus(downloaded, total)
  logger.info(`[sync] Downloading details for ${total} gists`)
  return Promise.map(gistList, gist => {
    return getGitHubApi(GET_SINGLE_GIST)(token, gist.id)
      .then(details => {
        downloaded += 1
        updateSnippetDownloadStatus(downloaded, total)
        return {
          id: gist.id,
          details: details
        }
      })
  }, { concurrency: GIST_DETAIL_SYNC_CONCURRENCY })
    .then((downloadedGists) => {
      const detailsById = {}
      downloadedGists.forEach(gist => {
        detailsById[gist.id] = gist.details
      })
      return detailsById
    })
}

function updateUserGists (userLoginId, token) {
  reduxStore.dispatch(updateGistSyncStatus('IN_PROGRESS'))
  updateLoginStatusInfo(LOGIN_STATUS.syncingSnippetIndex)
  return getGitHubApi(GET_ALL_GISTS)(token, userLoginId)
    .then((gistList) => {
      return downloadGistDetailsAfterListSync(gistList, token)
        .then(downloadedGistDetails => {
          return {
            downloadedGistDetails: downloadedGistDetails,
            gistList: gistList
          }
        })
    })
    .then(({ gistList, downloadedGistDetails }) => {
      const preGists = reduxStore.getState().gists
      const gists = {}
      const rawGistTags = {}
      const activeTagCandidate = Prefixed('All')
      rawGistTags[Prefixed('All')] = new Set()
      const gistTags = {}
      const fuseSearchIndex = []

      gistList.forEach((gist) => {
        const langs = new Set()

        Object.keys(gist.files).forEach(filename => {
          const file = gist.files[filename]
          const language = file.language || 'Other'
          langs.add(language)
          rawGistTags[Prefixed('All')].add(gist.id)

          // update the language tags
          const prefixedLang = Prefixed(language)
          if (Object.prototype.hasOwnProperty.call(rawGistTags, prefixedLang)) {
            rawGistTags[prefixedLang].add(gist.id)
          } else {
            rawGistTags[prefixedLang] = new Set()
            rawGistTags[prefixedLang].add(gist.id)
          }

          // update the custom tags
          const customTags = parseCustomTags(descriptionParser(gist.description).customTags)
          customTags.forEach(tag => {
            if (Object.prototype.hasOwnProperty.call(rawGistTags, tag)) {
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
          details: downloadedGistDetails[gist.id] || null
        }

        // Keep the date for the unchanged gist, so that user doesn't need
        // to resync.
        const preGist = preGists[gist.id]
        if (!gists[gist.id].details && preGist && preGist.details && preGist.details.updated_at === gist.updated_at) {
          gists[gist.id] = Object.assign(gists[gist.id], { details: preGist.details })
        }

        // Update the SearchIndex
        fuseSearchIndex.push(SearchIndex.buildSearchRecord(gists[gist.id]))
      }) // gistList.forEach

      SearchIndex.resetFuseIndex(fuseSearchIndex)

      for (const language in rawGistTags) {
        // Save the gist ids in an Array rather than a Set, which facilitate
        // many operations later, like displaying the gist id from an Array
        gistTags[language] = [...rawGistTags[language]]
      }

      // take the state snapshot at this moment
      takeSyncSnapshot()

      // refresh the redux state
      const humanReadableSyncTime = HumanReadableTime(new Date())
      setSyncTime(humanReadableSyncTime)
      updateGistStoreAfterSync(gists)
      updateGistTagsAfterSync(gistTags)
      updateActiveGistTagAfterSync(gistTags, activeTagCandidate)
      updateActiveGistAfterSync(gists, gistTags, activeTagCandidate)

      // clean up the snapshot for the previous state
      clearSyncSnapshot()

      notifySuccess(t('notification.syncSucceeds'), humanReadableSyncTime)

      reduxStore.dispatch(updateGistSyncStatus('DONE'))
    })
    .catch(err => {
      notifyFailure(t('notification.syncFailed'), t('notification.networkFailure', { code: '04' }))
      logger.error('The request has failed: ' + err)
      reduxStore.dispatch(updateGistSyncStatus('DONE'))
      throw err
    })
}
/** End: User gists management **/

/** Start: User session management **/
function initUserSession (token, options = {}) {
  logger.debug('[auth] initUserSession called ' + JSON.stringify({ hasCredential: Boolean(token) }))
  reduxStore.dispatch(updateUserSession({ activeStatus: 'IN_PROGRESS' }))
  updateLoginStatusInfo(options.freshOAuthToken
    ? LOGIN_STATUS.accessTokenReceived
    : LOGIN_STATUS.loadingGitHubProfile)
  initAccessToken(token)
  let newProfile = null
  getGitHubApi(GET_USER_PROFILE)(token)
    .then((profile) => {
      logger.debug('[auth] GET_USER_PROFILE succeeded ' + JSON.stringify(describeGitHubProfile(profile)))
      newProfile = profile
      return updateUserGists(profile.login, token)
    })
    .then(() => {
      logger.debug('-----> before updateLocalStorage')
      updateLocalStorage({
        token: token,
        profile: newProfile.login
      })
      logger.debug('-----> after updateLocalStorage')

      logger.debug('-----> before syncLocalPref')
      syncLocalPref(newProfile.login)
      logger.debug('-----> after syncLocalPref')

      electronBridge.window.setTitle(`${newProfile.login} | Lepton`) // update the app title

      logger.info('[Dispatch] updateUserSession ACTIVE')
      reduxStore.dispatch(updateUserSession({ activeStatus: 'ACTIVE', profile: newProfile }))
      updateLoginStatusInfo(LOGIN_STATUS.signInComplete)

      ipcRenderer.send('session-ready')
    })
    .catch((err) => {
      logger.debug('-----> Failure with ' + JSON.stringify(err))
      logger.error('The request has failed: \n' + JSON.stringify(err))
      updateLoginStatusFailure()

      if (err.statusCode === 401) {
        logger.info('[Dispatch] updateUserSession EXPIRED')
        reduxStore.dispatch(updateUserSession({ activeStatus: 'EXPIRED' }))
      } else {
        logger.info('[Dispatch] updateUserSession INACTIVE')
        reduxStore.dispatch(updateUserSession({ activeStatus: 'INACTIVE' }))
      }
      notifyFailure(t('notification.syncFailed'), t('notification.networkFailure', { code: '00' }))
    })
}
/** End: User session management **/

/** Start: Local storage management **/
function updateLocalStorage (data) {
  try {
    logger.debug('[auth] Caching credential metadata ' + JSON.stringify({ hasCredential: Boolean(data.token) }))
    let rst = electronBridge.credentials.setAccessToken(data.token)
    logger.debug(`[auth] [${rst.status}] Cached credential`)

    logger.debug(`-----> Caching profile ${data.profile}`)
    rst = electronBridge.localStorage.set('profile', data.profile)
    logger.debug(`-----> [${rst.status}] Cached profile ${data.profile}`)

    logger.debug('-----> User info is cached.')
  } catch (e) {
    logger.error(`-----> Failed to cache user info. ${JSON.stringify(e)}`)
  }
}

function getCachedUserInfo () {
  logger.debug('-----> Inside getCachedUserInfo')
  const cachedProfile = electronBridge.localStorage.get('profile')
  logger.debug(`-----> [${cachedProfile.status}] cachedProfile is ${cachedProfile.data}`)
  const cachedToken = electronBridge.credentials.getAccessToken()
  logger.debug('[auth] Cached credential lookup ' + JSON.stringify({
    status: cachedToken.status,
    hasCredential: Boolean(cachedToken.data)
  }))

  if (cachedProfile.status && cachedToken.status) {
    return {
      token: cachedToken.data,
      profile: cachedProfile.data
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
function allDialogsClosed (dialogsStatus) {
  return dialogsStatus.every(status => status === 'OFF')
}

function closeGistEditorIfOpen () {
  const { gistEditModalStatus, gistNewModalStatus } = reduxStore.getState()
  let didClose = false

  if (gistEditModalStatus === 'ON') {
    reduxStore.dispatch(updateGistEditModeStatus('OFF'))
    didClose = true
  }

  if (gistNewModalStatus === 'ON') {
    reduxStore.dispatch(updateGistNewModeStatus('OFF'))
    didClose = true
  }

  return didClose
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
    logoutModalStatus
  } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    immersiveMode,
    gistRawModal.status,
    gistEditModalStatus,
    gistNewModalStatus,
    aboutModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus]
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
    logoutModalStatus
  } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    aboutModalStatus,
    immersiveMode,
    gistRawModal.status,
    gistEditModalStatus,
    searchWindowStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus]
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
    logoutModalStatus
  } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    immersiveMode,
    gistRawModal.status,
    gistEditModalStatus,
    searchWindowStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus]
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
    logoutModalStatus
  } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    immersiveMode,
    gistRawModal.status,
    searchWindowStatus,
    aboutModalStatus,
    gistNewModalStatus,
    gistEditModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus]
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
    logoutModalStatus
  } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    gistRawModal.status,
    gistNewModalStatus,
    gistEditModalStatus,
    searchWindowStatus,
    aboutModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus]
  if (allDialogsClosed(dialogs)) {
    ipcRenderer.emit('edit-gist-renderer')
  }
})

ipcRenderer.on('delete-gist-check', data => {
  const state = reduxStore.getState()
  const {
    gistRawModal,
    searchWindowStatus,
    aboutModalStatus,
    gistNewModalStatus,
    gistEditModalStatus,
    gistDeleteModalStatus,
    dashboardModalStatus,
    logoutModalStatus
  } = state

  // FIXME: This should be able to extracted to the allDialogsClosed method.
  const dialogs = [
    gistRawModal.status,
    gistNewModalStatus,
    gistEditModalStatus,
    searchWindowStatus,
    aboutModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus,
    dashboardModalStatus]
  if (allDialogsClosed(dialogs)) {
    ipcRenderer.emit('delete-gist')
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
    logoutModalStatus
  } = state

  const dialogs = [
    searchWindowStatus,
    aboutModalStatus,
    gistRawModal.status,
    gistEditModalStatus,
    gistNewModalStatus,
    gistDeleteModalStatus,
    logoutModalStatus]
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

ipcRenderer.on('exit-editor', () => {
  closeGistEditorIfOpen()
})

ipcRenderer.on('update-available', payload => {
  const newVersionInfo = electronBridge.globals.getUpdateInfo()
  if (electronBridge.localStorage.get('skipped-version').data === newVersionInfo.version) return

  reduxStore.dispatch(updateNewVersionInfo(newVersionInfo))
  reduxStore.dispatch(updateUpdateAvailableBarStatus('ON'))
})
/** End: Response to  main process events **/

// Start
const renderFixture = getRenderFixture(getRenderFixtureName())
if (renderFixture) {
  logger.info(`[render-fixture] Rendering ${renderFixture.name} with mock state`)
  SearchIndex.resetFuseIndex(renderFixture.searchIndexRecords)
}

const reduxStore = renderFixture
  ? createStore(
    RootReducer,
    renderFixture.state,
    applyMiddleware(thunk)
  )
  : createStore(
    RootReducer,
    applyMiddleware(thunk)
  )

createRoot(document.getElementById('container')).render(
  <Provider store = { reduxStore }>
    <AppContainer
      searchIndex = { SearchIndex }
      initialSearchQuery = { renderFixture ? renderFixture.initialSearchQuery : undefined }
      localPref = { localPref }
      updateLocalStorage = { updateLocalStorage }
      loggedInUserInfo = { getCachedUserInfo() }
      launchAuthWindow = { launchAuthWindow }
      reSyncUserGists = { reSyncUserGists }
      updateAboutModalStatus = { updateAboutModalStatus }
      updateDashboardModalStatus = { updateDashboardModalStatus }
      updateActiveGistAfterClicked = { updateActiveGistAfterClicked } />
  </Provider>
)
