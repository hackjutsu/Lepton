import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const TransportStream = require('winston-transport')
const {
  createMainLogger,
  formatLogValue
} = require('../../app/utilities/logging/mainLogger')

const LOG_MESSAGE = Symbol.for('message')

class MemoryTransport extends TransportStream {
  constructor () {
    super()
    this.logs = []
  }

  log (info, callback) {
    this.logs.push(info[LOG_MESSAGE] || info.message)
    callback()
  }
}

describe('main logger', () => {
  it('formats extra log arguments without duplicating printf substitutions', () => {
    const transport = new MemoryTransport()
    const logger = createMainLogger({
      transports: [transport]
    })

    logger.info('plain', 'extra')
    logger.info('hello %s', 'world')
    logger.info('object', { a: 1 })

    expect(transport.logs[0]).toMatch(/info: plain extra$/)
    expect(transport.logs[1]).toMatch(/info: hello world$/)
    expect(transport.logs[1]).not.toContain('hello world world')
    expect(transport.logs[2]).toMatch(/info: object {"a":1}$/)
  })

  it('formats errors with stack context when available', () => {
    const error = new Error('failed')

    expect(formatLogValue(error)).toContain('Error: failed')
  })
})
