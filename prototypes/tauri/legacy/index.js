import './bridge'
import './local.css'
import localAvatar from '../../../app/utilities/octodex/dojocat.webp?inline'
import React from 'react'
import ProviderPanel from './ProviderPanel'
import { session, requestProvider } from './session'
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
import { advanceSessionGeneration } from '../../../app/utilities/sessionGeneration'
import { getRenderFixture } from '../../../app/renderFixtures'
import { addLangPrefix, descriptionParser, parseCustomTags } from '../../../app/utilities/parser'
import { createDefaultGistFilters, getActiveGistIdForFilters } from '../../../app/utilities/gistFilters'
import { updateAboutModalStatus, updateDashboardModalStatus, updateGists, updateGistTags, updateGistFilters, selectGist, updateSearchWindowStatus, updateImmersiveModeStatus, updateUserSession, updateAccessToken, updatePinnedTags } from '../../../app/actions'

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
const provider = { type: 'github' }
const cached = { profile: 'local', token: 'local', provider }
const fixture = getRenderFixture('active')
const store = createStore(RootReducer, { ...fixture.state, gists: {}, gistTags: {}, activeGist: null, pinnedTags: localPref.get('local')?.pinnedTags || [], userSession: { activeStatus: 'ACTIVE', profile }, accessToken: 'local' }, applyMiddleware(thunk))

async function loadSnippets (target) {
  if (target.mode === 'local') return invoke('local_gist_request', { operation: 'GET_ALL_GISTS', args: [] })
  const list = await requestProvider(invoke, 'GET_ALL_GISTS', [], target)
  const results = new Array(list.length)
  let next = 0
  async function worker () {
    while (next < list.length) {
      const index = next++
      results[index] = await requestProvider(invoke, 'GET_SINGLE_GIST', ['', list[index].id], target)
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, list.length) }, worker))
  return results
}

function applySnippets (snippets, local) {
  const gists = {}; const tags = { [addLangPrefix('All')]: [] }
  for (const savedGist of snippets) {
    const gist = local ? { ...savedGist, public: false } : savedGist
    const langs = new Set()
    for (const file of Object.values(gist.files)) langs.add(file.language || 'Other')
    gists[gist.id] = { brief: gist, details: gist, langs }
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
  const snippets = await loadSnippets(current)
  if (current.mode !== session.mode || current.base !== session.base || current.token !== session.token) return
  applySnippets(snippets, current.mode === 'local')
}
function canSwitch () {
  const state = store.getState()
  if (state.gistEditModalStatus === 'ON' || state.gistNewModalStatus === 'ON') throw new Error('Close the snippet editor before switching libraries.')
}
let renderProvider = () => {}
async function switchProvider (target) {
  canSwitch()
  let account = profile
  if (target.mode !== 'local') {
    const user = await requestProvider(invoke, 'GET_USER_PROFILE', [], target)
    account = { ...user, login: user.username || user.login, html_url: user.web_url || user.html_url, avatar_url: profileAvatar(user.avatar_url), storageKey: `${target.mode}:${target.base}:${user.username || user.login}`, providerType: target.mode }
  }
  const snippets = await loadSnippets(target)
  // Only switch after both authentication and data loading succeed.
  canSwitch()
  advanceSessionGeneration()
  setSnippetProvider(target.mode === 'local' ? { type: 'github' } : { type: target.mode, baseUrl: target.base })
  Object.assign(session, target)
  document.body.dataset.provider = target.mode
  store.dispatch(updateAccessToken(target.mode === 'local' ? 'local' : 'provider-session'))
  store.dispatch(updateUserSession({ activeStatus: 'ACTIVE', profile: account }))
  store.dispatch(updatePinnedTags(localPref.get(account.storageKey)?.pinnedTags || []))
  applySnippets(snippets, target.mode === 'local')
  renderProvider()
}

for (const [channel, key, action] of [
  ['search-gist', 'searchWindowStatus', updateSearchWindowStatus],
  ['dashboard', 'dashboardModalStatus', updateDashboardModalStatus],
  ['about-page', 'aboutModalStatus', updateAboutModalStatus],
  ['immersive-mode', 'immersiveMode', updateImmersiveModeStatus]
]) window.lepton.ipc.on(channel, () => store.dispatch(action(store.getState()[key] === 'ON' ? 'OFF' : 'ON')))

const panelNode = document.createElement('div')
document.body.appendChild(panelNode)
const panelRoot = createRoot(panelNode)
renderProvider = () => panelRoot.render(<ProviderPanel mode={session.mode} connect={(mode, base, token) => switchProvider({ mode, base, token })} disconnect={() => switchProvider({ mode: 'local', base: '', token: '' })} />)
document.body.dataset.provider = 'local'
renderProvider()
const root = createRoot(document.getElementById('container'))
reload().then(() => {
  root.render(<Provider store={store}><AppContainer searchIndex={SearchIndex} localPref={localPref} updateLocalStorage={() => {}} getCachedUserInfo={() => cached} loggedInUserInfo={cached} launchAuthWindow={() => {}} provider={provider} onProviderChange={() => provider} onGitLabHostChange={() => provider} reSyncUserGists={reload} updateAboutModalStatus={updateAboutModalStatus} updateDashboardModalStatus={updateDashboardModalStatus} updateActiveGistAfterClicked={(gists, tags, filters, active) => store.dispatch(selectGist(getActiveGistIdForFilters(tags, filters, active)))} /></Provider>)
}).catch(error => { root.render(<main style={{ padding: 24 }}>Unable to open the local library: {String(error)}</main>) })
