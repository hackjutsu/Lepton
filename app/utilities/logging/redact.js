const REDACTED_VALUE = '[REDACTED]'

const SECRET_KEY_PATTERN = /^(authorization|client_secret|token|access_token)$/i
const TOKEN_PATTERNS = [
  /github_pat_[A-Za-z0-9_]+/g,
  /gh[pousr]_[A-Za-z0-9_]+/g,
  /((?:with|cached|new|access|Caching|Cached)\s+token\s+)[^"',\s}\][]+/gi,
  /(cachedToken\s+is\s+)[^"',\s}\][]+/gi,
  /((?:token|access_token|client_secret|Authorization)["']?\s*[:=]\s*["']?)[^"',\s}\][]+/gi,
  /((?:Authorization|authorization)["']?\s*[:=]\s*["']?token\s+)[^"',\s}\][]+/gi
]
const LOG_METHODS = [
  'debug',
  'error',
  'info',
  'log',
  'silly',
  'verbose',
  'warn'
]

function redactString (value) {
  return TOKEN_PATTERNS.reduce((result, pattern) => {
    return result.replace(pattern, (...args) => {
      const prefix = args.slice(1, -2).find(arg => typeof arg === 'string')
      return prefix ? `${prefix}${REDACTED_VALUE}` : REDACTED_VALUE
    })
  }, value)
}

function redactSensitiveData (value, seen = []) {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value !== 'object') return value

  if (seen.indexOf(value) !== -1) return '[Circular]'
  const nextSeen = seen.concat(value)

  if (value instanceof Error) {
    const redactedError = {
      name: value.name,
      message: redactString(value.message || '')
    }
    if (value.stack) redactedError.stack = redactString(value.stack)
    Object.keys(value).forEach((key) => {
      redactedError[key] = SECRET_KEY_PATTERN.test(key)
        ? REDACTED_VALUE
        : redactSensitiveData(value[key], nextSeen)
    })
    return redactedError
  }

  if (Array.isArray(value)) {
    return value.map(item => redactSensitiveData(item, nextSeen))
  }

  return Object.keys(value).reduce((result, key) => {
    result[key] = SECRET_KEY_PATTERN.test(key)
      ? REDACTED_VALUE
      : redactSensitiveData(value[key], nextSeen)
    return result
  }, {})
}

function installLoggerRedaction (logger) {
  if (!logger || logger.__redactionInstalled) return logger

  LOG_METHODS.forEach((method) => {
    if (typeof logger[method] !== 'function') return

    const original = logger[method].bind(logger)
    logger[method] = (...args) => {
      return original(...args.map(arg => redactSensitiveData(arg)))
    }
  })

  Object.defineProperty(logger, '__redactionInstalled', {
    value: true
  })

  return logger
}

module.exports = {
  installLoggerRedaction,
  REDACTED_VALUE,
  redactSensitiveData
}
