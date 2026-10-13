import electronBridge from '../electronBridge'
import snippetOperations from './operations'
import {
  getConfiguredProvider,
  normalizeProviderConfig
} from '../snippetProvider'

export const EXCHANGE_ACCESS_TOKEN = snippetOperations.EXCHANGE_ACCESS_TOKEN
export const LIST_SNIPPETS = snippetOperations.LIST_SNIPPETS
export const GET_SNIPPET = snippetOperations.GET_SNIPPET
export const GET_USER_PROFILE = snippetOperations.GET_USER_PROFILE
export const CREATE_SNIPPET = snippetOperations.CREATE_SNIPPET
export const UPDATE_SNIPPET = snippetOperations.UPDATE_SNIPPET
export const DELETE_SNIPPET = snippetOperations.DELETE_SNIPPET

// Existing callers keep their Gist-oriented names while provider modules use
// the neutral operation names above.
export const GET_ALL_GISTS = LIST_SNIPPETS
export const GET_SINGLE_GIST = GET_SNIPPET
export const CREATE_SINGLE_GIST = CREATE_SNIPPET
export const EDIT_SINGLE_GIST = UPDATE_SNIPPET
export const DELETE_SINGLE_GIST = DELETE_SNIPPET

const SNIPPET_API_BRIDGE_RESPONSE = '__leptonSnippetApiBridgeResponse'

let activeProvider = getConfiguredProvider(electronBridge.config)

export function getSnippetProvider () {
  return activeProvider
}

export function refreshSnippetProvider () {
  return setSnippetProvider(getConfiguredProvider(electronBridge.config))
}

export function setSnippetProvider (provider) {
  activeProvider = normalizeProviderConfig(provider)
  return activeProvider
}

export function getSnippetApi (selection, provider = activeProvider) {
  const requestProvider = normalizeProviderConfig(provider)
  return (...args) => electronBridge.snippets.request(requestProvider, selection, args)
    .then(unwrapSnippetApiBridgeResponse)
}

function unwrapSnippetApiBridgeResponse (response) {
  if (!response || response[SNIPPET_API_BRIDGE_RESPONSE] !== true) {
    return response
  }

  if (response.ok) {
    return response.data
  }

  throw createSnippetApiBridgeError(response.error)
}

function createSnippetApiBridgeError (payload = {}) {
  const error = new Error(payload.message || 'Snippet API request failed')

  error.name = payload.name || 'SnippetApiBridgeError'
  Object.keys(payload).forEach(key => {
    if (payload[key] !== undefined) {
      error[key] = payload[key]
    }
  })

  return error
}
