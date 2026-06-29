const assert = require('assert')

const {
  installLoggerRedaction,
  REDACTED_VALUE,
  redactSensitiveData
} = require('../../app/utilities/logging/redact')

function createLogger () {
  const calls = []
  const logger = {
    debug: (...args) => calls.push(['debug'].concat(args)),
    error: (...args) => calls.push(['error'].concat(args)),
    info: (...args) => calls.push(['info'].concat(args))
  }
  return { calls, logger }
}

function assertNoSecret (value) {
  const serialized = JSON.stringify(value)
  assert(!serialized.includes('ghp_abc123'), serialized)
  assert(!serialized.includes('github_pat_abc123'), serialized)
  assert(!serialized.includes('plain-secret'), serialized)
  assert(!serialized.includes('header-secret'), serialized)
}

function testRedactsStrings () {
  assert.strictEqual(
    redactSensitiveData('Getting profile with token plain-secret'),
    `Getting profile with token ${REDACTED_VALUE}`
  )
  assert.strictEqual(redactSensitiveData('ghp_abc123'), REDACTED_VALUE)
  assert.strictEqual(redactSensitiveData('github_pat_abc123'), REDACTED_VALUE)
  assert.strictEqual(
    redactSensitiveData(`with token ${REDACTED_VALUE}`),
    `with token ${REDACTED_VALUE}`
  )
}

function testRedactsNestedObjects () {
  const input = {
    token: 'plain-secret',
    nested: {
      access_token: 'ghp_abc123',
      client_secret: 'plain-secret',
      headers: {
        Authorization: 'token header-secret'
      }
    },
    message: 'with token plain-secret'
  }

  const redacted = redactSensitiveData(input)

  assert.strictEqual(redacted.token, REDACTED_VALUE)
  assert.strictEqual(redacted.nested.access_token, REDACTED_VALUE)
  assert.strictEqual(redacted.nested.client_secret, REDACTED_VALUE)
  assert.strictEqual(redacted.nested.headers.Authorization, REDACTED_VALUE)
  assert.strictEqual(redacted.message, `with token ${REDACTED_VALUE}`)
  assertNoSecret(redacted)
}

function testRedactsErrors () {
  const error = new Error('failed with ghp_abc123')
  error.options = {
    headers: {
      Authorization: 'token header-secret'
    }
  }

  const redacted = redactSensitiveData(error)

  assert.strictEqual(redacted.name, 'Error')
  assert.strictEqual(redacted.message, `failed with ${REDACTED_VALUE}`)
  assert(redacted.stack.includes(REDACTED_VALUE))
  assert.strictEqual(redacted.options.headers.Authorization, REDACTED_VALUE)
  assertNoSecret(redacted)
}

function testHandlesCircularObjects () {
  const input = { token: 'plain-secret' }
  input.self = input

  const redacted = redactSensitiveData(input)

  assert.strictEqual(redacted.token, REDACTED_VALUE)
  assert.strictEqual(redacted.self, '[Circular]')
}

function testInstallsLoggerRedactionOnce () {
  const { calls, logger } = createLogger()

  installLoggerRedaction(logger)
  const wrappedDebug = logger.debug
  installLoggerRedaction(logger)

  assert.strictEqual(logger.debug, wrappedDebug)
  assert.strictEqual(logger.__redactionInstalled, true)

  logger.info('with token plain-secret')
  logger.debug({
    token: 'plain-secret',
    nested: {
      Authorization: 'token header-secret'
    }
  })
  logger.error(new Error('failed with ghp_abc123'))

  assert.deepStrictEqual(calls[0], ['info', `with token ${REDACTED_VALUE}`])
  assert.strictEqual(calls[1][1].token, REDACTED_VALUE)
  assert.strictEqual(calls[1][1].nested.Authorization, REDACTED_VALUE)
  assert.strictEqual(calls[2][1].message, `failed with ${REDACTED_VALUE}`)
  assertNoSecret(calls)
}

testRedactsStrings()
testRedactsNestedObjects()
testRedactsErrors()
testHandlesCircularObjects()
testInstallsLoggerRedactionOnce()

console.log('redact logging tests passed')
