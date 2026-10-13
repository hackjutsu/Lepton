import { describe, expect, it } from 'vitest'
import {
  advanceSessionGeneration,
  assertSessionGenerationCurrent,
  getSessionGeneration,
  isSessionGenerationCurrent,
  isStaleSessionError
} from '../../app/utilities/sessionGeneration'

describe('snippet session generation', () => {
  it('invalidates work captured by an earlier session', () => {
    const previous = getSessionGeneration()
    const current = advanceSessionGeneration()

    expect(isSessionGenerationCurrent(previous)).toBe(false)
    expect(isSessionGenerationCurrent(current)).toBe(true)
    expect(() => assertSessionGenerationCurrent(previous)).toThrow(
      'The snippet session changed while the request was in progress.'
    )

    try {
      assertSessionGenerationCurrent(previous)
    } catch (error) {
      expect(isStaleSessionError(error)).toBe(true)
    }
  })
})
