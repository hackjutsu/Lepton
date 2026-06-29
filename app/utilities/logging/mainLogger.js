const winston = require('winston')

const LOG_SPLAT = Symbol.for('splat')

function formatLogValue (value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || value.message

  try {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? String(value) : serialized
  } catch (error) {
    return String(value)
  }
}

function hasPrintfToken (message) {
  return typeof message === 'string' && /%[sdifjoO]/.test(message)
}

function createMainLogger (options = {}) {
  const loggerTransports = Object.prototype.hasOwnProperty.call(options, 'transports')
    ? options.transports
    : [new winston.transports.Console()]

  const captureRawMessage = winston.format(info => {
    info.rawMessage = info.message
    return info
  })

  const logFormat = winston.format.combine(
    winston.format.errors({ stack: true }),
    captureRawMessage(),
    winston.format.splat(),
    winston.format.timestamp(),
    winston.format.printf(info => {
      const splat = Array.isArray(info[LOG_SPLAT]) ? info[LOG_SPLAT] : []
      const message = info.stack || info.message
      const parts = hasPrintfToken(info.rawMessage)
        ? [message]
        : [message].concat(splat)
      return `${info.timestamp} ${info.level}: ${parts.map(formatLogValue).join(' ')}`
    })
  )

  return winston.createLogger({
    level: 'info',
    exitOnError: false,
    format: logFormat,
    transports: loggerTransports
  })
}

module.exports = {
  createMainLogger,
  formatLogValue
}
