import { Promise } from 'bluebird'
import { remote } from 'electron'
import { notifyFailure } from '../notifier'
import ProxyAgent from 'proxy-agent'
import ReqPromise from 'request-promise'

const TAG = '[GitLab Snippets] '
const kTimeoutUnit = 10 * 1000 // ms
const logger = remote.getGlobal('logger')
const conf = remote.getGlobal('conf')
const userAgent = 'your-app-user-agent'
let gitLabHostApi = 'gitlab.com'

let proxyAgent = null
if (conf) {
  if (conf.get('proxy:enable')) {
    const proxyUri = conf.get('proxy:address')
    proxyAgent = new ProxyAgent(proxyUri)
    logger.info('[config] Use proxy', proxyUri)
  }
  if (conf.get('gitlab:host')) {
    gitLabHostApi = conf.get('gitlab:host')
  }
}

function exchangeAccessToken (clientId, clientSecret, authCode) {
  // GitLab uses a different mechanism for access tokens, adjust accordingly
}

function getUserProfile (token) {
  logger.debug(TAG + 'Getting user profile with token ' + token)
  return ReqPromise({
    uri: `https://${gitLabHostApi}/api/v4/user`,
    agent: proxyAgent,
    headers: {
      'User-Agent': userAgent,
      'Private-Token': token
    },
    method: 'GET',
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function getSingleSnippet (token, snippetId) {
  logger.debug(TAG + `Getting single snippet ${snippetId} with token ${token}`)
  return ReqPromise({
    uri: `https://${gitLabHostApi}/api/v4/snippets/${snippetId}`,
    agent: proxyAgent,
    headers: {
      'User-Agent': userAgent,
      'Private-Token': token
    },
    method: 'GET',
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function getAllSnippets (token, userId) {
  logger.debug(TAG + `Getting all snippets with token ${token}`)
  return ReqPromise({
    uri: `https://${gitLabHostApi}/api/v4/snippets`,
    agent: proxyAgent,
    headers: {
      'User-Agent': userAgent,
      'Private-Token': token
    },
    method: 'GET',
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function createSingleSnippet (token, title, content, visibility) {
  logger.debug(TAG + 'Creating single snippet')
  return ReqPromise({
    uri: `https://${gitLabHostApi}/api/v4/snippets`,
    agent: proxyAgent,
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Private-Token': token
    },
    body: {
      title: title,
      content: content,
      visibility: visibility
    },
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function editSingleSnippet (token, snippetId, title, content, visibility) {
  logger.debug(TAG + 'Editing single snippet ' + snippetId)
  return ReqPromise({
    uri: `https://${gitLabHostApi}/api/v4/snippets/${snippetId}`,
    agent: proxyAgent,
    method: 'PUT',
    headers: {
      'User-Agent': userAgent,
      'Private-Token': token
    },
    body: {
      title: title,
      content: content,
      visibility: visibility
    },
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function deleteSingleSnippet (token, snippetId) {
  logger.debug(TAG + 'Deleting single snippet ' + snippetId)
  return ReqPromise({
    uri: `https://${gitLabHostApi}/api/v4/snippets/${snippetId}`,
    agent: proxyAgent,
    method: 'DELETE',
    headers: {
      'User-Agent': userAgent,
      'Private-Token': token
    },
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

export const EXCHANGE_ACCESS_TOKEN = 'EXCHANGE_ACCESS_TOKEN'
export const GET_ALL_GISTS = 'GET_ALL_GISTS'
export const GET_ALL_GISTS_V1 = 'GET_ALL_GISTS_V1'
export const GET_SINGLE_GIST = 'GET_SINGLE_GIST'
export const GET_USER_PROFILE = 'GET_USER_PROFILE'
export const CREATE_SINGLE_GIST = 'CREATE_SINGLE_GIST'
export const EDIT_SINGLE_GIST = 'EDIT_SINGLE_GIST'
export const DELETE_SINGLE_GIST = 'DELETE_SINGLE_GIST'

export function getGitLabApi (selection) {
  switch (selection) {
    case EXCHANGE_ACCESS_TOKEN:
      // Note: GitLab uses personal access tokens usually set up manually,
      // so this might not be applicable as in GitHub's case.
      // Implement if there's a specific requirement for OAuth flow.
      return exchangeAccessToken
    case GET_ALL_GISTS:
      return getAllSnippets
    case GET_ALL_GISTS_V1:
      // For compatibility with GitHub API; There is real v1 fallback.
      return getAllSnippets
    case GET_SINGLE_GIST:
      return getSingleSnippet
    case GET_USER_PROFILE:
      return getUserProfile
    case CREATE_SINGLE_GIST:
      return createSingleSnippet
    case EDIT_SINGLE_GIST:
      return editSingleSnippet
    case DELETE_SINGLE_GIST:
      return deleteSingleSnippet
    default:
      logger.debug(TAG + 'Not implemented yet.')
  }
}
