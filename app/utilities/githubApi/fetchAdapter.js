function createElectronFetchImpl () {
  const electron = require('electron')
  const defaultSession = electron && electron.session && electron.session.defaultSession

  if (defaultSession && typeof defaultSession.fetch === 'function') {
    return defaultSession.fetch.bind(defaultSession)
  }

  if (electron && electron.net && typeof electron.net.fetch === 'function') {
    return electron.net.fetch.bind(electron.net)
  }

  throw new Error('Electron fetch API is unavailable')
}

function createFetchRequest (fetchImpl) {
  const doFetch = fetchImpl || createElectronFetchImpl()

  return function fetchRequest (options) {
    const url = buildFetchUrl(options.uri, options.qs)
    const init = buildFetchInit(options)
    let timeoutId = null

    if (options.timeout && typeof AbortController !== 'undefined') {
      const controller = new AbortController()
      init.signal = controller.signal
      timeoutId = setTimeout(() => controller.abort(), options.timeout)
    }

    return Promise.resolve(doFetch(url, init))
      .then(response => {
        return readResponseBody(response, options.json)
          .then(body => {
            if (!isSuccessfulResponse(response)) {
              throw createStatusCodeError(response, body)
            }

            if (options.resolveWithFullResponse) {
              return {
                body: body,
                headers: headersToObject(response.headers),
                statusCode: response.status,
                statusMessage: response.statusText
              }
            }

            return body
          })
      })
      .finally(() => {
        if (timeoutId) clearTimeout(timeoutId)
      })
  }
}

function buildFetchUrl (uri, query) {
  const url = new URL(uri)

  if (query) {
    Object.keys(query).forEach(key => {
      url.searchParams.set(key, query[key])
    })
  }

  return url.toString()
}

function buildFetchInit (options) {
  const headers = buildHeaders(options)
  const body = buildBody(options, headers)
  const init = {
    method: options.method || 'GET',
    headers: headers
  }

  if (body !== undefined) {
    init.body = body
  }

  return init
}

function buildHeaders (options) {
  const headers = Object.assign({}, options.headers)

  if (options.json) {
    setHeaderIfMissing(headers, 'Accept', 'application/json')
  }

  return headers
}

function buildBody (options, headers) {
  if (options.form) {
    const formBody = new URLSearchParams()
    Object.keys(options.form).forEach(key => {
      formBody.append(key, options.form[key])
    })
    setHeaderIfMissing(headers, 'Content-Type', 'application/x-www-form-urlencoded')
    return formBody.toString()
  }

  if (Object.prototype.hasOwnProperty.call(options, 'body')) {
    if (options.json) {
      setHeaderIfMissing(headers, 'Content-Type', 'application/json')
      return JSON.stringify(options.body)
    }

    return options.body
  }

  return undefined
}

function setHeaderIfMissing (headers, name, value) {
  if (!hasHeader(headers, name)) {
    headers[name] = value
  }
}

function hasHeader (headers, name) {
  const normalizedName = name.toLowerCase()
  return Object.keys(headers).some(header => header.toLowerCase() === normalizedName)
}

function readResponseBody (response, shouldParseJson) {
  return response.text()
    .then(text => {
      if (!shouldParseJson) return text
      if (!text) return null
      try {
        return JSON.parse(text)
      } catch (err) {
        throw createResponseParseError(response, text, err)
      }
    })
}

function isSuccessfulResponse (response) {
  if (typeof response.ok === 'boolean') return response.ok
  return response.status >= 200 && response.status < 300
}

function createStatusCodeError (response, body) {
  const statusCode = response.status || 0
  const statusMessage = response.statusText || ''
  const message = `GitHub API request failed with status ${statusCode}${statusMessage ? ' ' + statusMessage : ''}`
  const error = new Error(message)

  error.name = 'StatusCodeError'
  error.status = statusCode
  error.statusCode = statusCode
  error.error = body
  error.response = {
    body: body,
    headers: headersToObject(response.headers),
    statusCode: statusCode,
    statusMessage: statusMessage
  }

  return error
}

function createResponseParseError (response, text, parseError) {
  const error = new Error('GitHub API response was not valid JSON')

  error.name = 'ResponseParseError'
  error.status = response.status || 0
  error.statusCode = response.status || 0
  error.error = {
    parseError: parseError.message,
    bodyPrefix: typeof text === 'string' ? text.slice(0, 200) : ''
  }

  return error
}

function headersToObject (headers) {
  const result = {}

  if (!headers) return result

  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value
    })
  } else {
    Object.keys(headers).forEach(key => {
      result[key.toLowerCase()] = headers[key]
    })
  }

  const linkHeader = getHeaderValue(headers, 'link')
  if (linkHeader && !result.link) {
    result.link = linkHeader
  }

  return result
}

function getHeaderValue (headers, name) {
  if (!headers) return undefined

  if (typeof headers.get === 'function') {
    return headers.get(name)
  }

  return headers[name] || headers[name.toLowerCase()]
}

module.exports = {
  createElectronFetchImpl,
  createFetchRequest
}
