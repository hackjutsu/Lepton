import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
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

function expectNoSecret (value) {
  const serialized = JSON.stringify(value)
  expect(serialized).not.toContain('ghp_abc123')
  expect(serialized).not.toContain('github_pat_abc123')
  expect(serialized).not.toContain('plain-secret')
  expect(serialized).not.toContain('header-secret')
}

describe('logging redaction', () => {
  it('redacts token-like strings', () => {
    expect(redactSensitiveData('Getting profile with token plain-secret'))
      .toBe(`Getting profile with token ${REDACTED_VALUE}`)
    expect(redactSensitiveData('ghp_abc123')).toBe(REDACTED_VALUE)
    expect(redactSensitiveData('github_pat_abc123')).toBe(REDACTED_VALUE)
    expect(redactSensitiveData(`with token ${REDACTED_VALUE}`))
      .toBe(`with token ${REDACTED_VALUE}`)
  })

  it('redacts nested secret fields and authorization headers', () => {
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

    expect(redacted.token).toBe(REDACTED_VALUE)
    expect(redacted.nested.access_token).toBe(REDACTED_VALUE)
    expect(redacted.nested.client_secret).toBe(REDACTED_VALUE)
    expect(redacted.nested.headers.Authorization).toBe(REDACTED_VALUE)
    expect(redacted.message).toBe(`with token ${REDACTED_VALUE}`)
    expectNoSecret(redacted)
  })

  it('redacts errors without losing useful error shape', () => {
    const error = new Error('failed with ghp_abc123')
    error.options = {
      headers: {
        Authorization: 'token header-secret'
      }
    }

    const redacted = redactSensitiveData(error)

    expect(redacted.name).toBe('Error')
    expect(redacted.message).toBe(`failed with ${REDACTED_VALUE}`)
    expect(redacted.stack).toContain(REDACTED_VALUE)
    expect(redacted.options.headers.Authorization).toBe(REDACTED_VALUE)
    expectNoSecret(redacted)
  })

  it('handles circular objects', () => {
    const input = { token: 'plain-secret' }
    input.self = input

    const redacted = redactSensitiveData(input)

    expect(redacted.token).toBe(REDACTED_VALUE)
    expect(redacted.self).toBe('[Circular]')
  })

  it('wraps logger methods only once', () => {
    const { calls, logger } = createLogger()

    installLoggerRedaction(logger)
    const wrappedDebug = logger.debug
    installLoggerRedaction(logger)

    expect(logger.debug).toBe(wrappedDebug)
    expect(logger.__redactionInstalled).toBe(true)

    logger.info('with token plain-secret')
    logger.debug({
      token: 'plain-secret',
      nested: {
        Authorization: 'token header-secret'
      }
    })
    logger.error(new Error('failed with ghp_abc123'))

    expect(calls[0]).toEqual(['info', `with token ${REDACTED_VALUE}`])
    expect(calls[1][1].token).toBe(REDACTED_VALUE)
    expect(calls[1][1].nested.Authorization).toBe(REDACTED_VALUE)
    expect(calls[2][1].message).toBe(`failed with ${REDACTED_VALUE}`)
    expectNoSecret(calls)
  })
})
