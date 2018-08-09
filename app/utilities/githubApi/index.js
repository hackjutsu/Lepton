'use strict'

import { Promise } from 'bluebird'
import Request from 'request'
import ReqPromise from 'request-promise'
import Notifier from '../notifier'
import ProxyAgent from 'proxy-agent'
import { remote } from 'electron'

const TAG = '[REST] '
const kTimeoutUnit = 10 * 1000 // ms
const logger = remote.getGlobal('logger')
const conf = remote.getGlobal('conf')
const userAgent = 'hackjutsu-lepton-app'
let gitHubHostApi = 'api.github.com'

let proxyAgent = null
if (conf) {
  if (conf.get('proxy:enable')) {
    const proxyUri = conf.get('proxy:address')
    proxyAgent = new ProxyAgent(proxyUri)
    logger.info('[.leptonrc] Use proxy', proxyUri)
  }
  if (conf.get('enterprise:enable')) {
    const gitHubHost = conf.get('enterprise:host')
    gitHubHostApi = `${gitHubHost}/api/v3`
  }
}

function exchangeAccessToken (clientId, clientSecret, authCode) {
  logger.debug(TAG + 'Exchanging authCode with access token')
  return ReqPromise({
    method: 'POST',
    uri: 'https://github.com/login/oauth/access_token',
    agent: proxyAgent,
    form: {
      'client_id': clientId,
      'client_secret': clientSecret,
      'code': authCode,
    },
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function getUserProfile (token) {
  logger.debug(TAG + 'Getting user profile with token ' + token)
  const USER_PROFILE_URI = `https://${gitHubHostApi}/user`
  return ReqPromise({
    uri: USER_PROFILE_URI,
    agent: proxyAgent,
    headers: {
      'User-Agent': userAgent,
    },
    method: 'GET',
    qs: {
      access_token: token
    },
    json: true, // Automatically parses the JSON string in the response
    timeout: 2 * kTimeoutUnit
  })
}

function getSingleGist (token, gistId) {
  logger.debug(TAG + `Getting single gist ${gistId} with token ${token}`)
  const SINGLE_GIST_URI = `https://${gitHubHostApi}/gists/`
  return ReqPromise({
    uri: SINGLE_GIST_URI + gistId,
    agent: proxyAgent,
    headers: {
      'User-Agent': userAgent
    },
    method: 'GET',
    qs: {
      access_token: token
    },
    json: true, // Automatically parses the JSON string in the response
    timeout: 2 * kTimeoutUnit
  })
}

function getAllGistsV2 (token, userId) {
  logger.debug(TAG + `[V2] Getting all gists of ${userId} with token ${token}`)
  const gistList = []
  return requestGists(token, userId, 1, gistList)
    .then(res => {
      if (!res.headers['link']) {
        logger.debug(TAG + '[V2] The header missing link property')
        logger.debug(TAG + JSON.stringify(res.headers))
        logger.debug(TAG + `The length of gistList is ${gistList.length}`)

        // Falling back to getAllGistsV1 to deal with two-factor Authenticated clients
        logger.debug(TAG + `[V2] Falling back to [V1]...`)
        return getAllGistsV1(token, userId)
      }

      const matches = res.headers['link'].match(/page=[0-9]*/g)
      const maxPage = matches[matches.length - 1].substring('page='.length)
      logger.debug(TAG + `[V2] The max page number for gist is ${maxPage}`)

      const requests = []
      for (let i = 2; i <= maxPage; ++i) { requests.push(requestGists(token, userId, i, gistList)) }
      return Promise.all(requests)
        .then(() => {
          return gistList.sort((g1, g2) => g2.updated_at.localeCompare(g1.updated_at))
        })
    })
    .catch(err => {
      logger.debug(TAG + `[V2] Something wrong happens ${err}. Falling back to [V1]...`)
      return getAllGistsV1(token, userId)
    })
}

function requestGists (token, userId, page, gistList) {
  logger.debug(TAG + '[V2] Requesting gists with page ' + page)
  return ReqPromise(makeOptionForGetAllGists(token, userId, page))
    .catch(err => {
      logger.error(err)
    })
    .then(res => {
      parseBody(res.body, gistList)
      return res
    })
}

function parseBody (res, gistList) {
  for (let key in res) { if (res.hasOwnProperty(key)) gistList.push(res[key]) }
}

const EMPTY_PAGE_ERROR_MESSAGE = 'page empty (Not an error)'
function getAllGistsV1 (token, userId) {
  logger.debug(TAG + `[V1] Getting all gists of ${userId} with token ${token}`)
  let gistList = []
  return new Promise((resolve, reject) => {
    const maxPageNumber = 100
    let funcs = Promise.resolve(
      makeRangeArr(1, maxPageNumber).map(
        (n) => makeRequestForGetAllGists(makeOptionForGetAllGists(token, userId, n))))

    funcs.mapSeries(iterator)
      .catch(err => {
        if (err !== EMPTY_PAGE_ERROR_MESSAGE) {
          logger.error(err)
          Notifier('Sync failed', 'Please check your network condition. 05')
        }
      })
      .finally(() => {
        resolve(gistList)
      })
  })

  function iterator (f) {
    return f()
  }

  function makeRequestForGetAllGists (option) {
    return () => {
      return new Promise((resolve, reject) => {
        Request(option, (error, response, body) => {
          logger.debug('The gist number on this page is ' + body.length)
          if (error) {
            reject(error)
          } else if (body.length === 0) {
            reject(EMPTY_PAGE_ERROR_MESSAGE)
          } else {
            for (let key in body) {
              if (body.hasOwnProperty(key)) {
                gistList.push(body[key])
              }
            }
            resolve(body)
          }
        })
      })
    }
  }
}

function makeRangeArr (start, end) {
  let result = []
  for (let i = start; i <= end; i++) result.push(i)
  return result
}

const GISTS_PER_PAGE = 100
function makeOptionForGetAllGists (token, userId, page) {
  return {
    uri: `https://${gitHubHostApi}/users/${userId}/gists`,
    agent: proxyAgent,
    headers: {
      'User-Agent': userAgent,
    },
    method: 'GET',
    qs: {
      access_token: token,
      per_page: GISTS_PER_PAGE,
      page: page
    },
    json: true,
    timeout: 2 * kTimeoutUnit,
    resolveWithFullResponse: true
  }
}

function createSingleGist (token, description, files, isPublic) {
  logger.debug(TAG + 'Creating single gist')
  return ReqPromise({
    headers: {
      'User-Agent': userAgent,
    },
    method: 'POST',
    uri: `https://${gitHubHostApi}/gists`,
    agent: proxyAgent,
    qs: {
      access_token: token
    },
    body: {
      description: description,
      public: isPublic,
      files: files
    },
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function editSingleGist (token, gistId, updatedDescription, updatedFiles) {
  logger.debug(TAG + 'Editing single gist ' + gistId)
  return ReqPromise({
    headers: {
      'User-Agent': userAgent,
    },
    method: 'PATCH',
    uri: `https://${gitHubHostApi}/gists/${gistId}`,
    agent: proxyAgent,
    qs: {
      access_token: token
    },
    body: {
      description: updatedDescription,
      files: updatedFiles
    },
    json: true,
    timeout: 2 * kTimeoutUnit
  })
}

function deleteSingleGist (token, gistId) {
  logger.debug(TAG + 'Deleting single gist ' + gistId)
  return ReqPromise({
    headers: {
      'User-Agent': userAgent,
    },
    method: 'DELETE',
    uri: `https://${gitHubHostApi}/gists/${gistId}`,
    agent: proxyAgent,
    qs: {
      access_token: token
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

export function getGitHubApi (selection) {
  switch (selection) {
    case EXCHANGE_ACCESS_TOKEN:
      return exchangeAccessToken
    case GET_ALL_GISTS:
      return getAllGistsV2
    case GET_ALL_GISTS_V1:
      return getAllGistsV1
    case GET_SINGLE_GIST:
      return getSingleGist
    case GET_USER_PROFILE:
      return getUserProfile
    case CREATE_SINGLE_GIST:
      return createSingleGist
    case EDIT_SINGLE_GIST:
      return editSingleGist
    case DELETE_SINGLE_GIST:
      return deleteSingleGist
    default:
      logger.debug(TAG + 'Not implemented yet.')
  }
}
