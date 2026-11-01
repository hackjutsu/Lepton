import './bridge'
import './local.css'
import localAvatar from '../../../app/utilities/octodex/dojocat.webp?inline'
import React from 'react'
import HumanReadableTime from 'human-readable-time'
import { session, requestProvider, githubStarredUrl, isOfflineError, loadRemoteSnapshot, loadRemoteSnippets, loginFailureStatus, enqueueCache } from './session'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import { thunk } from 'redux-thunk'
import { invoke } from '@tauri-apps/api/core'
import '../../../app/utilities/vendor/bootstrap/css/bootstrap.css'
import AppContainer from '../../../app/containers/appContainer'
import RootReducer from '../../../app/reducers'
import SearchIndex from '../../../app/utilities/search'
import Store from '../../../app/utilities/store'
import { configureI18n } from '../../../app/utilities/i18n'
import { setSnippetProvider } from '../../../app/utilities/snippetApi'
import { getConfiguredProvider } from '../../../app/utilities/snippetProvider'
import { advanceSessionGeneration } from '../../../app/utilities/sessionGeneration'
import { getRenderFixture } from '../../../app/renderFixtures'
import { addLangPrefix, descriptionParser, parseCustomTags } from '../../../app/utilities/parser'
import { createDefaultGistFilters, getActiveGistIdForFilters } from '../../../app/utilities/gistFilters'
import { updateAboutModalStatus, updateDashboardModalStatus, updateGists, updateGistTags, updateGistFilters, selectGist, updateSearchWindowStatus, updateImmersiveModeStatus, updateUserSession, updateAccessToken, updatePinnedTags, updateLoginStatus, updateSyncTime } from '../../../app/actions'

configureI18n(window.lepton.config.get('i18n:locale'))
const localPref = new Store({ configName: 'user-preferences', defaults: {} })
const profile = { login: 'Local library', storageKey: 'local', avatar_url: localAvatar, html_url: '' }
// An unavailable remote avatar must not leave the profile panel blank.
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement && event.target.classList.contains('profile-image-section') && event.target.src !== new URL(localAvatar, document.baseURI).href) event.target.src = localAvatar
}, true)
function profileAvatar (url) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : localAvatar
  } catch (_) { return localAvatar }
}
let provider = getConfiguredProvider(window.lepton.config)
const cached = { profile: null, token: null, provider }
const fixture = getRenderFixture('active')
const store = createStore(RootReducer, { ...fixture.state, gists: {}, gistTags: {}, activeGist: null, pinnedTags: localPref.get('local')?.pinnedTags || [], userSession: { activeStatus: 'ACTIVE', profile }, accessToken: 'local' }, applyMiddleware(thunk))

async function loadSnippets (target, progress = () => {}, cached = [], selectedId = null) {
  if (target.mode === 'local') return invoke('local_gist_request', { operation: 'GET_ALL_GISTS', args: [] })
  progress('Syncing snippet index...')
  const list = await requestProvider(invoke, 'GET_ALL_GISTS', [], target)
  return loadRemoteSnippets(list, brief => requestProvider(invoke, 'GET_SINGLE_GIST', ['', brief.id], target), {
    cached, selectedId, progress, provider: target.mode,
    downloadAll: Boolean(window.lepton.config.get('snippet:downloadAll'))
  })
}

function applySnippets (snippets, local) {
  const gists = {}; const tags = { [addLangPrefix('All')]: [] }
  for (const savedGist of snippets) {
    const gist = local ? { ...savedGist, public: false } : savedGist
    const langs = new Set()
    for (const file of Object.values(gist.files)) langs.add(file.language || 'Other')
    gists[gist.id] = { brief: gist, details: gist._leptonBrief ? null : gist, langs }
    tags[addLangPrefix('All')].push(gist.id)
    for (const lang of langs) (tags[addLangPrefix(lang)] ||= []).push(gist.id)
    for (const tag of parseCustomTags(descriptionParser(gist).customTags)) (tags[tag] ||= []).push(gist.id)
  }
  SearchIndex.resetFuseIndex(Object.values(gists).map(gist => SearchIndex.buildSearchRecord(gist)))
  store.dispatch(updateGists(gists))
  store.dispatch(updateGistTags(tags))
  store.dispatch(updateGistFilters(createDefaultGistFilters()))
  const previous = store.getState().activeGist
  store.dispatch(selectGist(previous && gists[previous] ? previous : snippets[0]?.id || null))
}
async function reload () {
  const current = { ...session }
  let snippets
  const state = store.getState()
  const cached = Object.values(state.gists).map(gist => gist.details).filter(Boolean)
  try { snippets = await loadSnippets(current, undefined, cached, state.activeGist) } catch (error) {
    if (current.mode !== 'local') {
      if (current.account !== session.account || current.token !== session.token) return
      if (isOfflineError(error)) store.dispatch(updateSyncTime('Offline'))
      window.lepton.logger.warn('Snippet sync failed', error)
      await window.lepton.dialog.showMessage({ message: isOfflineError(error) ? 'Sync failed because the provider is offline. Your current snippets are still available.' : 'Sync failed. Your current snippets are still available.' })
      return
    }
    throw error
  }
  if (current.mode !== session.mode || current.base !== session.base || current.token !== session.token) return
  if (current.revision !== session.revision) {
    await window.lepton.dialog.showMessage({ message: 'A snippet changed during sync. Please sync again.' })
    return
  }
  applySnippets(snippets, current.mode === 'local')
  store.dispatch(updateSyncTime(HumanReadableTime(new Date())))
  if (current.account) {
    const accountProfile = store.getState().userSession.profile
    try { await enqueueCache(() => invoke('save_remote_cache', { account: current.account, profile: accountProfile, snippets, syncedAt: new Date().toISOString() })) } catch (_) { window.lepton.logger.warn('Unable to save the remote snippet cache') }
  }
}
function canSwitch () {
  const state = store.getState()
  if (state.gistEditModalStatus === 'ON' || state.gistNewModalStatus === 'ON') throw new Error('Close the snippet editor before switching libraries.')
}
async function switchProvider (target, progress = () => {}, knownAccount = null) {
  canSwitch()
  let account = profile
  let snippets
  let offline = false
  let syncedAt = null
  if (target.mode !== 'local') {
    const snapshot = await loadRemoteSnapshot(knownAccount, target, async () => {
      progress('Loading profile...')
      const user = await requestProvider(invoke, 'GET_USER_PROFILE', [], target)
      const account = { ...user, login: user.username || user.login, html_url: user.web_url || user.html_url, avatar_url: profileAvatar(user.avatar_url), starred_url: target.mode === 'github' ? githubStarredUrl(target.base, user.login) : null, storageKey: `${target.mode}:${target.base}:${user.username || user.login}`, providerType: target.mode }
      let cached = []
      try {
        const saved = await invoke('load_remote_cache', { account: { provider: target.mode, base: target.base, login: account.login } })
        cached = saved?.snippets || []
      } catch (_) { window.lepton.logger.warn('Unable to load the remote snippet cache') }
      return { account, snippets: await loadSnippets(target, progress, cached) }
    }, account => invoke('load_remote_cache', { account }))
    account = snapshot.account; snippets = snapshot.snippets; offline = snapshot.offline; syncedAt = snapshot.syncedAt
  } else snippets = await loadSnippets(target, progress)
  // Only switch after both authentication and data loading succeed.
  canSwitch()
  advanceSessionGeneration()
  setSnippetProvider(target.mode === 'local' ? { type: 'github' } : { type: target.mode, baseUrl: target.base })
  activeRemoteAccount = target.mode === 'local' ? null : { provider: target.mode, base: target.base, login: account.login }
  const connectedAccount = activeRemoteAccount
  Object.assign(session, target, { account: activeRemoteAccount, revision: 0 })
  document.body.dataset.provider = target.mode
  store.dispatch(updateAccessToken(target.mode === 'local' ? 'local' : 'provider-session'))
  store.dispatch(updateUserSession({ activeStatus: 'ACTIVE', profile: account }))
  store.dispatch(updatePinnedTags(localPref.get(account.storageKey)?.pinnedTags || []))
  applySnippets(snippets, target.mode === 'local')
  store.dispatch(updateSyncTime(offline ? `Offline · ${HumanReadableTime(new Date(syncedAt))}` : HumanReadableTime(new Date())))
  if (connectedAccount && !offline) {
    try { await enqueueCache(() => invoke('save_remote_cache', { account: connectedAccount, profile: account, snippets, syncedAt: new Date().toISOString() })) } catch (_) { window.lepton.logger.warn('Unable to save the remote snippet cache') }
  }
  return { offline, connectedAccount }
}

// Reuse Lepton's existing login and logout screens for account switching.
let loginPending = false
let activeRemoteAccount = null
async function launchAuthWindow (token, previousAccount = null) {
  if (loginPending) return
  loginPending = true
  store.dispatch(updateLoginStatus({}))
  store.dispatch(updateUserSession({ activeStatus: 'IN_PROGRESS' }))
  try {
    if (!token) store.dispatch(updateLoginStatus({ message: 'Opening OAuth...' }))
    const credential = token || await invoke('start_github_oauth')
    const { offline, connectedAccount } = await switchProvider({ mode: provider.type, base: provider.baseUrl, token: credential }, message => store.dispatch(updateLoginStatus({ message })), previousAccount)
    if (activeRemoteAccount !== connectedAccount) return
    try {
      if (!offline || !previousAccount) await invoke('remember_remote_account', { account: connectedAccount, token: credential })
      if (activeRemoteAccount !== connectedAccount) await invoke('forget_remote_account', { account: connectedAccount })
    } catch (error) {
      window.lepton.logger.warn('Could not save account in secure storage', error)
      if (activeRemoteAccount === connectedAccount) await window.lepton.dialog.showMessage({ message: 'Signed in, but the account could not be saved securely. You may need to sign in again after restarting.' })
    }
  } catch (error) {
    if (previousAccount && /\bHTTP 401\b/.test(String(error))) {
      try { await invoke('forget_remote_account', { account: previousAccount }) } catch (_) { window.lepton.logger.warn('Could not remove invalid saved credential') }
    }
    store.dispatch(updateUserSession({ activeStatus: 'INACTIVE' }))
    window.lepton.logger.error('Sign-in failed', error)
    store.dispatch(updateLoginStatus(loginFailureStatus(error, window.lepton.globals.getPaths().logFilePath)))
  } finally { loginPending = false }
}
window.lepton.ipc.on('session-destroyed', () => {
  const wasRemote = session.mode !== 'local'
  const previousAccount = activeRemoteAccount
  activeRemoteAccount = null
  Object.assign(session, { mode: 'local', base: '', token: '', account: null, revision: 0 })
  document.body.dataset.provider = 'local'
  setSnippetProvider({ type: 'github' })
  if (wasRemote) {
    if (previousAccount) invoke('forget_remote_account', { account: previousAccount }).catch(() => window.lepton.dialog.showMessage({ message: 'Could not remove the saved account from secure storage.' }))
  }
})

for (const [channel, key, action] of [
  ['search-gist', 'searchWindowStatus', updateSearchWindowStatus],
  ['dashboard', 'dashboardModalStatus', updateDashboardModalStatus],
  ['about-page', 'aboutModalStatus', updateAboutModalStatus],
  ['immersive-mode', 'immersiveMode', updateImmersiveModeStatus]
]) window.lepton.ipc.on(channel, () => store.dispatch(action(store.getState()[key] === 'ON' ? 'OFF' : 'ON')))

document.body.dataset.provider = 'local'
const root = createRoot(document.getElementById('container'))
reload().then(() => {
  const refreshProvider = () => { provider = getConfiguredProvider(window.lepton.config); return provider }
  root.render(<Provider store={store}><AppContainer searchIndex={SearchIndex} localPref={localPref} updateLocalStorage={() => {}} getCachedUserInfo={() => cached} loggedInUserInfo={cached} launchAuthWindow={launchAuthWindow} provider={provider} onProviderChange={refreshProvider} onGitLabHostChange={refreshProvider} reSyncUserGists={reload} updateAboutModalStatus={updateAboutModalStatus} updateDashboardModalStatus={updateDashboardModalStatus} updateActiveGistAfterClicked={(gists, tags, filters, active) => store.dispatch(selectGist(getActiveGistIdForFilters(tags, filters, active)))} /></Provider>)
  invoke('take_startup_github_token').then(async token => {
    if (token) {
      provider = { type: 'github', baseUrl: 'https://github.com' }
      return launchAuthWindow(token)
    }
    const saved = await invoke('restore_remote_account')
    if (!saved) return
    provider = { type: saved.provider, baseUrl: saved.base }
    return launchAuthWindow(saved.token, { provider: saved.provider, base: saved.base, login: saved.login })
  }).catch(error => {
    store.dispatch(updateUserSession({ activeStatus: 'INACTIVE' }))
    store.dispatch(updateLoginStatus({ level: 'error', message: String(error) }))
  })
}).catch(error => { root.render(<main style={{ padding: 24 }}>Unable to open the local library: {String(error)}</main>) })
