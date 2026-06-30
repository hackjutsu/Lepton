const { Promise } = require('bluebird')
const ProxyAgent = require('proxy-agent')
const ReqPromise = require('request-promise')
const Request = require('request')
const { shouldDownloadAllSnippets } = require('../config')

const TAG = '[REST] '
const kTimeoutUnit = 10 * 1000 // ms
const userAgent = 'hackjutsu-lepton-app'
const GISTS_PER_PAGE = 100
const EMPTY_PAGE_ERROR_MESSAGE = 'page empty (Not an error)'

const EXCHANGE_ACCESS_TOKEN = 'EXCHANGE_ACCESS_TOKEN'
const GET_ALL_GISTS = 'GET_ALL_GISTS'
const GET_ALL_GISTS_V1 = 'GET_ALL_GISTS_V1'
const GET_SINGLE_GIST = 'GET_SINGLE_GIST'
const GET_USER_PROFILE = 'GET_USER_PROFILE'
const CREATE_SINGLE_GIST = 'CREATE_SINGLE_GIST'
const EDIT_SINGLE_GIST = 'EDIT_SINGLE_GIST'
const DELETE_SINGLE_GIST = 'DELETE_SINGLE_GIST'

function createGitHubApi ({
  conf,
  logger,
  ProxyAgentImpl = ProxyAgent,
  requestPromiseImpl = ReqPromise,
  requestImpl = Request
}) {
  const apiLogger = logger || {
    debug: () => {},
    error: () => {},
    info: () => {}
  }
  let gitHubHostApi = 'api.github.com'
  let proxyAgent = null

  if (conf) {
    if (conf.get('proxy:enable')) {
      const proxyUri = conf.get('proxy:address')
      proxyAgent = new ProxyAgentImpl(proxyUri)
      apiLogger.info('[.leptonrc] Use proxy', proxyUri)
    }
    if (conf.get('enterprise:enable')) {
      const gitHubHost = conf.get('enterprise:host')
      gitHubHostApi = `${gitHubHost}/api/v3`
    }
  }

  function exchangeAccessToken (clientId, clientSecret, authCode) {
    apiLogger.debug(TAG + 'Exchanging authCode with access token')
    return requestPromiseImpl({
      method: 'POST',
      uri: 'https://github.com/login/oauth/access_token',
      agent: proxyAgent,
      form: {
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode
      },
      json: true,
      timeout: 2 * kTimeoutUnit
    })
  }

  function getUserProfile (token) {
    apiLogger.debug(TAG + 'Getting user profile with token ' + token)
    return requestPromiseImpl({
      uri: `https://${gitHubHostApi}/user`,
      agent: proxyAgent,
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'GET',
      json: true,
      timeout: 2 * kTimeoutUnit
    })
  }

  function getSingleGist (token, gistId) {
    apiLogger.debug(TAG + `Getting single gist ${gistId} with token ${token}`)
    return requestPromiseImpl({
      uri: `https://${gitHubHostApi}/gists/${gistId}`,
      agent: proxyAgent,
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'GET',
      json: true,
      timeout: 2 * kTimeoutUnit
    })
  }

  function getAllGistsV2 (token, userId) {
    apiLogger.debug(TAG + `[V2] Getting all gists of ${userId} with token ${token}`)
    const gistList = []
    return requestGists(token, userId, 1, gistList)
      .then(res => {
        if (!res.headers.link) {
          apiLogger.debug(TAG + '[V2] The header missing link property')
          apiLogger.debug(TAG + JSON.stringify(res.headers))
          apiLogger.debug(TAG + `The length of gistList is ${gistList.length}`)
          return sortGistsByUpdatedAt(gistList)
        }

        const matches = res.headers.link.match(/page=[0-9]*/g)
        const maxPage = matches[matches.length - 1].substring('page='.length)
        apiLogger.debug(TAG + `[V2] The max page number for gist is ${maxPage}`)

        const requests = []
        for (let i = 2; i <= maxPage; ++i) requests.push(requestGists(token, userId, i, gistList))
        return Promise.all(requests)
          .then(() => sortGistsByUpdatedAt(gistList))
      })
      .catch(err => {
        apiLogger.debug(TAG + `[V2] Something wrong happens ${err}. Falling back to [V1]...`)
        return getAllGistsV1(token, userId)
      })
  }

  function requestGists (token, userId, page, gistList) {
    apiLogger.debug(TAG + '[V2] Requesting gists with page ' + page)
    return requestPromiseImpl(makeOptionForGetAllGists(token, userId, page))
      .catch(err => {
        apiLogger.error(err)
      })
      .then(res => {
        parseBody(res.body, gistList)
        return res
      })
  }

  function parseBody (res, gistList) {
    for (const key in res) {
      if (Object.prototype.hasOwnProperty.call(res, key)) gistList.push(res[key])
    }
  }

  function sortGistsByUpdatedAt (gistList) {
    return gistList.sort((g1, g2) => g2.updated_at.localeCompare(g1.updated_at))
  }

  function getAllGistsV1 (token, userId) {
    apiLogger.debug(TAG + `[V1] Getting all gists of ${userId} with token ${token}`)
    const gistList = []
    return new Promise(resolve => {
      const maxPageNumber = 100
      const funcs = Promise.resolve(
        makeRangeArr(1, maxPageNumber).map(
          (n) => makeRequestForGetAllGists(makeOptionForGetAllGists(token, userId, n))))

      funcs.mapSeries(iterator)
        .catch(err => {
          if (err !== EMPTY_PAGE_ERROR_MESSAGE) {
            apiLogger.error(err)
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
          requestImpl(option, (error, response, body) => {
            apiLogger.debug('The gist number on this page is ' + body.length)
            if (error) {
              reject(error)
            } else if (body.length === 0) {
              reject(EMPTY_PAGE_ERROR_MESSAGE)
            } else {
              for (const key in body) {
                if (Object.prototype.hasOwnProperty.call(body, key)) {
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
    const result = []
    for (let i = start; i <= end; i++) result.push(i)
    return result
  }

  function makeOptionForGetAllGists (token, userId, page) {
    const shouldDownloadAllGists = shouldDownloadAllSnippets(conf)
    const uri = shouldDownloadAllGists
      ? `https://${gitHubHostApi}/gists`
      : `https://${gitHubHostApi}/users/${userId}/gists`

    return {
      uri: uri,
      agent: proxyAgent,
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'GET',
      qs: {
        per_page: GISTS_PER_PAGE,
        page: page
      },
      json: true,
      timeout: 2 * kTimeoutUnit,
      resolveWithFullResponse: true
    }
  }

  function createSingleGist (token, description, files, isPublic) {
    apiLogger.debug(TAG + 'Creating single gist')
    return requestPromiseImpl({
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'POST',
      uri: `https://${gitHubHostApi}/gists`,
      agent: proxyAgent,
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
    apiLogger.debug(TAG + 'Editing single gist ' + gistId)
    return requestPromiseImpl({
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'PATCH',
      uri: `https://${gitHubHostApi}/gists/${gistId}`,
      agent: proxyAgent,
      body: {
        description: updatedDescription,
        files: updatedFiles
      },
      json: true,
      timeout: 2 * kTimeoutUnit
    })
  }

  function deleteSingleGist (token, gistId) {
    apiLogger.debug(TAG + 'Deleting single gist ' + gistId)
    return requestPromiseImpl({
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'DELETE',
      uri: `https://${gitHubHostApi}/gists/${gistId}`,
      agent: proxyAgent,
      json: true,
      timeout: 2 * kTimeoutUnit
    })
  }

  function getGitHubApi (selection) {
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
        apiLogger.debug(TAG + 'Not implemented yet.')
    }
  }

  return {
    getGitHubApi
  }
}

module.exports = {
  CREATE_SINGLE_GIST,
  DELETE_SINGLE_GIST,
  EDIT_SINGLE_GIST,
  EXCHANGE_ACCESS_TOKEN,
  GET_ALL_GISTS,
  GET_ALL_GISTS_V1,
  GET_SINGLE_GIST,
  GET_USER_PROFILE,
  createGitHubApi
}
