// Provider credentials are held in memory only. Never serialize this object.
import redaction from '../../../app/utilities/logging/redact'
export const session = { mode: 'local', base: '', token: '', account: null, revision: 0 }
const { redactSensitiveData } = redaction
let cacheQueue = Promise.resolve()
export function enqueueCache (work) {
  const result = cacheQueue.then(work)
  cacheQueue = result.catch(() => {})
  return result
}

export function formatLogArguments (args, token = '') {
  return args.map(value => {
    const redacted = redactSensitiveData(value)
    let text
    try { text = typeof redacted === 'string' ? redacted : JSON.stringify(redacted) } catch (_) { text = '[Unserializable]' }
    text = String(text)
    return token ? text.split(token).join('[REDACTED]') : text
  }).join(' ')
}

// Match the original GitHub adapter's web link, not the API's repository-star URL.
export function githubStarredUrl (base, login) {
  if (!login) return null
  const url = new URL(base)
  const host = url.hostname === 'github.com' ? 'gist.github.com' : `gist.${url.host}`
  return `${url.protocol}//${host}/${encodeURIComponent(login)}/starred`
}

export function loginFailureStatus (error, logFilePath) {
  if (/\bHTTP 401\b/.test(String(error))) return { level: 'error', message: 'Token invalid. Please try again.', logFilePath: null }
  return { level: 'error', message: 'Sign-in failed.', logFilePath: logFilePath || null }
}

export function isOfflineError (error) {
  return /^(GitHub|GitLab) network request failed$/.test(String(error))
}

export function unavailableGithubSnippet (brief, error) {
  const message = String(error)
  if (![
    'GitHub returned an incomplete file list; this snippet cannot be edited safely',
    'GitHub raw file exceeds the supported size',
    'GitHub raw file is not UTF-8 text'
  ].includes(message)) return null
  return { ...brief, files: brief.files || {}, _leptonUnavailable: 'This snippet cannot be displayed or edited safely here. Open it on GitHub to view it.' }
}

export async function loadRemoteSnapshot (knownAccount, target, fetchLive, loadCache) {
  try { return { ...(await fetchLive()), offline: false } } catch (error) {
    if (!knownAccount || knownAccount.provider !== target.mode || knownAccount.base !== target.base || !isOfflineError(error)) throw error
    const cached = await loadCache(knownAccount)
    if (!cached) throw error
    return { account: cached.profile, snippets: cached.snippets, offline: true, syncedAt: cached.syncedAt }
  }
}

// Keep metadata for every snippet, fetching content only when requested.
export async function loadRemoteSnippets (list, fetchDetails, options = {}) {
  const cachedById = new Map((options.cached || []).filter(Boolean).map(gist => [gist.id, gist]))
  const results = list.map(brief => {
    const cached = cachedById.get(brief.id)
    if (brief.updated_at && cached && !cached._leptonBrief && !cached._leptonUnavailable &&
      cached.updated_at === brief.updated_at) return cached
    return { ...brief, _leptonBrief: true }
  })
  const selected = list.findIndex(gist => gist.id === options.selectedId)
  const first = selected < 0 ? 0 : selected
  const pending = results.map((gist, index) => index).filter(index =>
    results[index]._leptonBrief && (options.downloadAll || index === first))
  let next = 0
  let downloaded = 0
  async function worker () {
    while (next < pending.length) {
      const index = pending[next++]
      try {
        results[index] = await fetchDetails(list[index])
      } catch (error) {
        const unavailable = options.provider === 'github' && unavailableGithubSnippet(list[index], error)
        if (!unavailable) throw error
        results[index] = unavailable
      }
      if (options.progress) options.progress(`Downloading snippets (${++downloaded}/${pending.length})`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, pending.length) }, worker))
  return results
}

export async function requestProvider (invoke, operation, args = [], state = session) {
  const actions = {
    GET_USER_PROFILE: ['profile', () => []],
    GET_ALL_GISTS: ['list', () => []],
    GET_SINGLE_GIST: ['get', values => [values[1]]],
    CREATE_SINGLE_GIST: ['create', values => values.slice(1, 4)],
    EDIT_SINGLE_GIST: ['update', values => values.slice(1, 4)],
    DELETE_SINGLE_GIST: ['delete', values => [values[1]]]
  }
  const entry = actions[operation]
  if (!entry) throw new Error('Unsupported GitLab operation')
  const snapshot = { ...state }
  const config = globalThis.window?.lepton?.config
  const address = config?.get('proxy:address')
  const proxy = config?.get('proxy:enable') && typeof address === 'string' && address.trim() ? address : null
  let result
  try {
    result = await invoke(snapshot.mode === 'github' ? 'github_request' : 'gitlab_request', { base: snapshot.base, token: snapshot.token, operation: entry[0], args: entry[1](args), proxy })
  } catch (error) {
    const unavailable = state === session && snapshot.mode === 'github' && operation === 'GET_SINGLE_GIST' &&
      unavailableGithubSnippet({ id: args[1], files: {} }, error)
    if (!unavailable) throw error
    return unavailable
  }
  if (state === session && snapshot.account) {
    if (session.account === snapshot.account && session.token === snapshot.token && ['CREATE_SINGLE_GIST', 'EDIT_SINGLE_GIST', 'DELETE_SINGLE_GIST'].includes(operation)) session.revision++
    try {
      if (operation === 'GET_SINGLE_GIST' || operation === 'CREATE_SINGLE_GIST' || operation === 'EDIT_SINGLE_GIST') await enqueueCache(() => invoke('update_remote_cache', { account: snapshot.account, gist: result }))
      if (operation === 'DELETE_SINGLE_GIST') await enqueueCache(() => invoke('delete_remote_cache', { account: snapshot.account, id: args[1] }))
    } catch (_) {
      // The remote mutation already succeeded; do not report it as a failed save.
      globalThis.window?.lepton?.logger?.warn('Unable to update the remote snippet cache')
    }
  }
  if (result?._leptonRefreshPending && state === session && session.account === snapshot.account) {
    globalThis.window?.lepton?.dialog?.showMessage({ message: 'Saved successfully, but the latest snippet could not be reloaded. Sync again when the connection is available.' })?.catch(() => {})
  }
  return result
}
