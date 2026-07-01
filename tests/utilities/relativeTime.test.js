import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from '../../app/utilities/relativeTime'

describe('formatRelativeTime', () => {
  const baseDate = new Date('2026-01-01T12:00:00.000Z')

  it('formats recent past timestamps in the existing snippet style', () => {
    expect(formatRelativeTime('2026-01-01T11:59:30.000Z', baseDate)).toBe('a few seconds ago')
    expect(formatRelativeTime('2026-01-01T11:59:00.000Z', baseDate)).toBe('a minute ago')
    expect(formatRelativeTime('2026-01-01T11:55:00.000Z', baseDate)).toBe('5 minutes ago')
    expect(formatRelativeTime('2026-01-01T10:00:00.000Z', baseDate)).toBe('2 hours ago')
    expect(formatRelativeTime('2025-12-29T12:00:00.000Z', baseDate)).toBe('3 days ago')
  })

  it('formats larger past ranges with month and year labels', () => {
    expect(formatRelativeTime('2025-11-22T12:00:00.000Z', baseDate)).toBe('a month ago')
    expect(formatRelativeTime('2025-10-03T12:00:00.000Z', baseDate)).toBe('3 months ago')
    expect(formatRelativeTime('2024-11-27T12:00:00.000Z', baseDate)).toBe('a year ago')
    expect(formatRelativeTime('2023-12-23T12:00:00.000Z', baseDate)).toBe('2 years ago')
  })

  it('formats future timestamps', () => {
    expect(formatRelativeTime('2026-01-01T14:00:00.000Z', baseDate)).toBe('in 2 hours')
  })

  it('returns an empty string for invalid dates', () => {
    expect(formatRelativeTime('not-a-date', baseDate)).toBe('')
    expect(formatRelativeTime(baseDate, 'not-a-date')).toBe('')
  })
})
