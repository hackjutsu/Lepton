import './bridge'
import './local.css'
import localAvatar from '../../../app/utilities/octodex/dojocat.webp?inline'
import React from 'react'
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
import { getRenderFixture } from '../../../app/renderFixtures'
import { addLangPrefix, descriptionParser, parseCustomTags } from '../../../app/utilities/parser'
import { createDefaultGistFilters, getActiveGistIdForFilters } from '../../../app/utilities/gistFilters'
import { updateAboutModalStatus, updateDashboardModalStatus, updateGists, updateGistTags, updateGistFilters, selectGist, updateSearchWindowStatus, updateImmersiveModeStatus } from '../../../app/actions'

configureI18n(window.lepton.config.get('i18n:locale'))
const localPref = new Store({ configName: 'user-preferences', defaults: {} })
const profile = { login: 'Local library', storageKey: 'local', avatar_url: localAvatar, html_url: '' }
const provider = { type: 'github' }
const cached = { profile: 'local', token: 'local', provider }
const fixture = getRenderFixture('active')
const store = createStore(RootReducer, { ...fixture.state, gists: {}, gistTags: {}, activeGist: null, pinnedTags: localPref.get('local')?.pinnedTags || [], userSession: { activeStatus: 'ACTIVE', profile }, accessToken: 'local' }, applyMiddleware(thunk))

async function reload () {
  const snippets = await invoke('local_gist_request', { operation: 'GET_ALL_GISTS', args: [] })
  const gists = {}; const tags = { [addLangPrefix('All')]: [] }
  for (const savedGist of snippets) {
    const gist = { ...savedGist, public: false }
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

for (const [channel, key, action] of [
  ['search-gist', 'searchWindowStatus', updateSearchWindowStatus],
  ['dashboard', 'dashboardModalStatus', updateDashboardModalStatus],
  ['about-page', 'aboutModalStatus', updateAboutModalStatus],
  ['immersive-mode', 'immersiveMode', updateImmersiveModeStatus]
]) window.lepton.ipc.on(channel, () => store.dispatch(action(store.getState()[key] === 'ON' ? 'OFF' : 'ON')))

const root = createRoot(document.getElementById('container'))
reload().then(() => {
  root.render(<Provider store={store}><AppContainer searchIndex={SearchIndex} localPref={localPref} updateLocalStorage={() => {}} getCachedUserInfo={() => cached} loggedInUserInfo={cached} launchAuthWindow={() => {}} provider={provider} onProviderChange={() => provider} onGitLabHostChange={() => provider} reSyncUserGists={reload} updateAboutModalStatus={updateAboutModalStatus} updateDashboardModalStatus={updateDashboardModalStatus} updateActiveGistAfterClicked={(gists, tags, filters, active) => store.dispatch(selectGist(getActiveGistIdForFilters(tags, filters, active)))} /></Provider>)
}).catch(error => { root.render(<main style={{ padding: 24 }}>Unable to open the local library: {String(error)}</main>) })
