const { Promise } = require('bluebird')
const { createFetchRequest } = require('./fetchAdapter')
const { shouldDownloadAllSnippets } = require('../config')

const TAG = '[REST] '
const kTimeoutUnit = 10 * 1000 // ms
const userAgent = 'lepton-snippet-app'
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
  fetchImpl
} = {}) {
  const apiLogger = logger || {
    debug: () => {},
    error: () => {},
    info: () => {}
  }
  const apiRequest = createFetchRequest(fetchImpl)
  let gitHubHostApi = 'api.github.com'

  if (conf && conf.get('enterprise:enable')) {
    const gitHubHost = conf.get('enterprise:host')
    gitHubHostApi = `${gitHubHost}/api/v3`
  }

  function exchangeAccessToken (clientId, clientSecret, authCode) {
    apiLogger.debug(TAG + 'Exchanging authCode with access credential ' + JSON.stringify({
      hasClientId: Boolean(clientId),
      clientIdLength: clientId ? clientId.length : 0,
      hasClientSecret: Boolean(clientSecret),
      codeLength: authCode ? authCode.length : 0
    }))
    return apiRequest({
      method: 'POST',
      uri: 'https://github.com/login/oauth/access_token',
      headers: {
        'User-Agent': userAgent
      },
      form: {
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode
      },
      json: true,
      timeout: 2 * kTimeoutUnit
    }).then(payload => {
      apiLogger.debug(TAG + 'OAuth credential exchange response metadata ' + JSON.stringify(describeOAuthAccessTokenResponse(payload)))
      return validateOAuthAccessTokenResponse(payload)
    })
  }

  function getUserProfile (token) {
    apiLogger.debug(TAG + 'Getting user profile ' + JSON.stringify({ hasCredential: Boolean(token) }))
    return apiRequest({
      uri: `https://${gitHubHostApi}/user`,
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
    apiLogger.debug(TAG + `Getting single gist ${gistId} ` + JSON.stringify({ hasCredential: Boolean(token) }))
    return apiRequest({
      uri: `https://${gitHubHostApi}/gists/${gistId}`,
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
    apiLogger.debug(TAG + `[V2] Getting all gists of ${userId} ` + JSON.stringify({ hasCredential: Boolean(token) }))
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
        if (!matches || matches.length === 0) {
          apiLogger.debug(TAG + '[V2] The header link property does not include page markers')
          return sortGistsByUpdatedAt(gistList)
        }

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
    return apiRequest(makeOptionForGetAllGists(token, userId, page))
      .then(res => {
        parseBody(res.body, gistList)
        return res
      })
  }

  function parseBody (res, gistList) {
    if (!res) return

    for (const key in res) {
      if (Object.prototype.hasOwnProperty.call(res, key)) gistList.push(res[key])
    }
  }

  function sortGistsByUpdatedAt (gistList) {
    return gistList.sort((g1, g2) => g2.updated_at.localeCompare(g1.updated_at))
  }

  function getAllGistsV1 (token, userId) {
    apiLogger.debug(TAG + `[V1] Getting all gists of ${userId} ` + JSON.stringify({ hasCredential: Boolean(token) }))
    const gistList = []
    const maxPageNumber = 100

    return Promise.mapSeries(makeRangeArr(1, maxPageNumber), page => {
      return apiRequest(makeOptionForGetAllGists(token, userId, page))
        .then(res => {
          const body = Array.isArray(res.body) ? res.body : []
          apiLogger.debug('The gist number on this page is ' + body.length)

          if (body.length === 0) {
            throw EMPTY_PAGE_ERROR_MESSAGE
          }

          parseBody(body, gistList)
          return body
        })
    })
      .catch(err => {
        if (err !== EMPTY_PAGE_ERROR_MESSAGE) {
          apiLogger.error(err)
        }
      })
      .then(() => gistList)
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
    return apiRequest({
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'POST',
      uri: `https://${gitHubHostApi}/gists`,
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
    return apiRequest({
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'PATCH',
      uri: `https://${gitHubHostApi}/gists/${gistId}`,
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
    return apiRequest({
      headers: {
        'User-Agent': userAgent,
        Authorization: 'token ' + token
      },
      method: 'DELETE',
      uri: `https://${gitHubHostApi}/gists/${gistId}`,
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

function validateOAuthAccessTokenResponse (payload) {
  if (payload && payload.access_token) {
    return payload
  }

  const errorCode = payload && payload.error ? payload.error : 'missing_access_token'
  const errorDescription = payload && payload.error_description
    ? payload.error_description
    : 'GitHub OAuth did not return an access token.'
  const error = new Error(`GitHub OAuth token exchange failed: ${errorCode}`)

  error.name = 'OAuthTokenExchangeError'
  error.error = payload || { error: errorCode, error_description: errorDescription }
  error.errorDescription = errorDescription

  throw error
}

function describeOAuthAccessTokenResponse (payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      hasPayload: Boolean(payload)
    }
  }

  return removeUndefinedProperties({
    hasAccessCredential: Boolean(payload.access_token),
    credentialType: payload.token_type,
    scope: payload.scope,
    error: payload.error,
    errorDescription: payload.error_description
  })
}

function removeUndefinedProperties (value) {
  Object.keys(value).forEach(key => {
    if (value[key] === undefined) {
      delete value[key]
    }
  })
  return value
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
