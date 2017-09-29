'use strict'

import { Promise } from 'bluebird'
import Request from 'request'
import ReqPromise from 'request-promise'
import Notifier from '../notifier'
import nconf from 'nconf'
import ProxyAgent from 'proxy-agent'
import { remote } from 'electron'

const TAG = '[REST] '
const logger = remote.getGlobal('logger')
const userAgent = 'hackjutsu-lepton-app' 

const configFilePath = remote.app.getPath('home') + '/.leptonrc'
let proxyAgent = null
try {
  nconf.argv()
    .env()
    .file({ file: configFilePath })
  if (nconf.get('proxy:enable')) {
    const proxyUri = nconf.get('proxy:address')
    proxyAgent = new ProxyAgent(proxyUri)
    logger.info('use proxy', proxyUri)
  }
} catch (error) {
  logger.error('Please correct the mistakes in your configuration file: [%s].\n' + error, configFilePath)
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
    json: true
  })
}

function getUserProfile (token) {
  logger.debug(TAG + 'Getting user profile with token ' + token)
  const USER_PROFILE_URI = 'https://api.github.com/user'
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
    json: true // Automatically parses the JSON string in the response
  })
}

function getSingleGist (token, gistId) {
  logger.debug(TAG + `Getting single gist ${gistId} with token ${token}`)
  const SINGLE_GIST_URI = 'https://api.github.com/gists/'
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
    json: true // Automatically parses the JSON string in the response
  })
}

function getAllgistsV2 (token, userId) {
  logger.debug(TAG + `[V2] Getting all gists of ${userId} with token ${token}`)
  const gistList = []
  return requestGists(token, userId, 1, gistList)
    .then((res) => {
      const matches = res.headers['link'].match(/page=[0-9]*/g)
      const maxPage = matches[matches.length-1].substring('page='.length)
      logger.debug(TAG + `[V2] The max page number for gist is ${maxPage}`)

      const requests = []
      for(let i=2; i<=maxPage; ++i)
        requests.push(requestGists(token, userId, i, gistList))

      return Promise.all(requests)
    })
    .then(() => {
      gistList.sort((g1, g2) => g2.last_updated_at - g1.last_updated_at)
      return gistList
    })
}

function requestGists(token, userId, page, gistList) {
  logger.debug(TAG + '[V2] Requesting gists with page ' + page)
  return ReqPromise(makeOptionForGetAllGists(token, userId, page))
    .catch(err => {
      logger.err(err)
    })
    .then((res) => {
      parseBody(res.body, gistList)
      return res
    })
}

function parseBody(res, gistList) {
  for(let key in res)
    if (res.hasOwnProperty(key)) gistList.push(res[key])
}

const EMPTY_PAGE_ERROR_MESSAGE = 'page empty (Not an error)'
function getAllgistsV1 (token, userId) {
  logger.debug(TAG + `[V1] Getting all gists of ${userId} with token ${token}`)
  let gistList = []
  return new Promise(function (resolve, reject) {
    const maxPageNumber = 100
    let funcs = Promise.resolve(
      makeRangeArr(1, maxPageNumber).map(
        (n) => makeRequestForGetAllGists(makeOptionForGetAllGists(token, userId, n))))

    funcs.mapSeries(iterator)
      .catch(err => {
        if (err !== EMPTY_PAGE_ERROR_MESSAGE) {
          logger.error(err)
          Notifier('Sync failed', 'Please check your network condition.')
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
    return function () {
      return new Promise(function (resolve, reject) {
        Request(option, function (error, response, body) {
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

const GISTS_PER_PAGE = 100;
function makeOptionForGetAllGists (token, userId, page) {
  return {
    uri: 'https://api.github.com/users/' + userId + '/gists',
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
    uri: 'https://api.github.com/gists',
    agent: proxyAgent,
    qs: {
      access_token: token
    },
    body: {
      description: description,
      public: isPublic,
      files: files
    },
    json: true
  })
}

function editSingleGist (token, gistId, updatedDescription, updatedFiles) {
  logger.debug(TAG + 'Editing single gist ' + gistId)
  return ReqPromise({
    headers: {
      'User-Agent': userAgent,
    },
    method: 'PATCH',
    uri: 'https://api.github.com/gists/' + gistId,
    agent: proxyAgent,
    qs: {
      access_token: token
    },
    body: {
      description: updatedDescription,
      files: updatedFiles
    },
    json: true
  })
}

function deleteSingleGist (token, gistId) {
  logger.debug(TAG + 'Deleting single gist ' + gistId)
  return ReqPromise({
    headers: {
      'User-Agent': userAgent,
    },
    method: 'DELETE',
    uri: 'https://api.github.com/gists/' + gistId,
    agent: proxyAgent,
    qs: {
      access_token: token
    },
    json: true
  })
}

export const EXCHANGE_ACCESS_TOKEN = 'EXCHANGE_ACCESS_TOKEN'
export const GET_ALL_GISTS = 'GET_ALL_GISTS'
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
      return getAllgistsV2
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
