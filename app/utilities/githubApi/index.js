import electronBridge from '../electronBridge'

export const EXCHANGE_ACCESS_TOKEN = 'EXCHANGE_ACCESS_TOKEN'
export const GET_ALL_GISTS = 'GET_ALL_GISTS'
export const GET_ALL_GISTS_V1 = 'GET_ALL_GISTS_V1'
export const GET_SINGLE_GIST = 'GET_SINGLE_GIST'
export const GET_USER_PROFILE = 'GET_USER_PROFILE'
export const CREATE_SINGLE_GIST = 'CREATE_SINGLE_GIST'
export const EDIT_SINGLE_GIST = 'EDIT_SINGLE_GIST'
export const DELETE_SINGLE_GIST = 'DELETE_SINGLE_GIST'

const GITHUB_API_BRIDGE_RESPONSE = '__leptonGitHubApiBridgeResponse'

export function getGitHubApi (selection) {
  return (...args) => electronBridge.github.request(selection, args)
    .then(unwrapGitHubApiBridgeResponse)
}

function unwrapGitHubApiBridgeResponse (response) {
  if (!response || response[GITHUB_API_BRIDGE_RESPONSE] !== true) {
    return response
  }

  if (response.ok) {
    return response.data
  }

  throw createGitHubApiBridgeError(response.error)
}

function createGitHubApiBridgeError (payload = {}) {
  const error = new Error(payload.message || 'GitHub API request failed')

  error.name = payload.name || 'GitHubApiBridgeError'
  Object.keys(payload).forEach(key => {
    if (payload[key] !== undefined) {
      error[key] = payload[key]
    }
  })

  return error
}
