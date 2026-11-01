import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { session, requestProvider } from './session'
import { matchesAccelerator } from './shortcuts'
import defaults from '../../../configs/defaultConfig'
import { renderNotebookContent } from '../../../app/utilities/jupyterNotebook/core'

const configKey = 'lepton-local-config'
function load (key, fallback) {
  try { return JSON.parse(window.localStorage.getItem(key)) ?? fallback } catch (_) { return fallback }
}
function save (key, value) { window.localStorage.setItem(key, JSON.stringify(value)); return { status: true, data: value } }
function mergeConfig (base, override) {
  const result = { ...base }
  for (const [key, value] of Object.entries(override || {})) {
    if (!(key in base)) continue
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object'
      ? mergeConfig(base[key], value) : value
  }
  return result
}
const runtime = window.__leptonRuntimeInfo
const config = mergeConfig(mergeConfig(defaults, load(configKey, {})), runtime.config)
function find (path) { return path.split(':').reduce((node, key) => node == null ? undefined : node[key], config) }
async function set (path, value) {
  await invoke('set_runtime_config', { key: path, value })
  const parts = path.split(':'); const key = parts.pop()
  let node = config
  for (const part of parts) { node[part] = node[part] || {}; node = node[part] }
  node[key] = value
  save(configKey, config)
  return value
}
const listeners = new Map()
function emit (channel, ...args) { (listeners.get(channel) || []).forEach(fn => fn(...args)) }
const shortcutChannels = {
  keyShortcutForSearch: 'search-gist',
  keyNewGist: 'new-gist-renderer',
  keyEditGist: 'edit-gist-renderer',
  keyDeleteGist: 'delete-gist',
  keySubmitGist: 'submit-gist',
  keyImmersiveMode: 'immersive-mode',
  keyDashboard: 'dashboard',
  keyAboutPage: 'about-page',
  keySyncGists: 'sync-gists'
}
window.addEventListener('keydown', event => {
  if (event.repeat) return
  for (const [setting, channel] of Object.entries(shortcutChannels)) {
    if (!matchesAccelerator(event, find(`shortcuts:${setting}`), navigator.platform)) continue
    const modalOpen = Boolean(document.querySelector('.modal[role="dialog"]'))
    if (modalOpen && channel !== 'submit-gist') return
    if (channel === 'submit-gist' && !document.querySelector('.gist-editor-form')) return
    event.preventDefault()
    emit(channel)
    return
  }
})

function openExternal (url) { return invoke('open_external', { url }) }
document.addEventListener('click', event => {
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!anchor) return
  const href = anchor.getAttribute('href') || ''
  if (!/^https?:\/\//i.test(href)) return
  event.preventDefault()
  openExternal(href).catch(() => window.alert('Could not open the link.'))
})

window.lepton = {
  isLocalPrototype: true,
  account: { get: () => ({}) },
  app: { getAppPath: () => '', getPath: () => '' },
  auth: { startGitHubLogin: () => Promise.reject(new Error('Online providers are not available in the local prototype')) },
  clipboard: { writeText },
  config: { get: find, set, setForRestart: set },
  credentials: { getAccessToken: () => ({ status: true, data: null }), setAccessToken: () => ({ status: true }) },
  dialog: { showMessage: options => { window.alert(options.message); return Promise.resolve({ response: 0 }) } },
  files: { ensureConfigFile: defaults => invoke('ensure_runtime_config', { defaults }) },
  globals: { getPaths: () => ({ configFilePath: runtime.configFilePath, logFilePath: runtime.logFilePath }), getUpdateInfo: () => ({}) },
  ipc: { emit, on: (channel, fn) => { if (!listeners.has(channel)) listeners.set(channel, new Set()); listeners.get(channel).add(fn); return () => listeners.get(channel).delete(fn) }, removeAllListeners: channel => listeners.delete(channel), send: emit },
  logger: { debug: () => {}, info: () => {}, warn: () => { invoke('log_runtime_event', { level: 'warn' }).catch(() => {}) }, error: () => { invoke('log_runtime_event', { level: 'error' }).catch(() => {}) } },
  localStorage: { get: key => ({ status: true, data: load('lepton-local-' + key, null) }), set: (key, value) => save('lepton-local-' + key, value) },
  notebook: { render: content => { try { return { status: true, html: renderNotebookContent(content) } } catch (error) { return { status: false, error: String(error) } } } },
  shell: { openExternal, openPath: path => invoke('open_runtime_file', { path }) },
  snippets: { request: (_provider, operation, args) => {
    if (session.mode !== 'local') return requestProvider(invoke, operation, args)
    if (operation === 'CREATE_SINGLE_GIST' || operation === 'EDIT_SINGLE_GIST') args = [...args, new Date().toISOString()]
    return invoke('local_gist_request', { operation, args }).then(result => {
      if (result && !Array.isArray(result) && typeof result === 'object') return { ...result, public: false }
      return result
    })
  } },
  store: { get: (name, fallback) => load('lepton-store-' + name, fallback), set: (name, data) => save('lepton-store-' + name, data) },
  window: { onFindInPageRequest: () => () => {}, setTitle: title => { document.title = title } }
}
