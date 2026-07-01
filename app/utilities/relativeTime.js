const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const RELATIVE_TIME_THRESHOLDS = [
  { limit: 45 * SECOND, phrase: 'a few seconds' },
  { limit: 90 * SECOND, phrase: 'a minute' },
  { limit: 45 * MINUTE, unit: 'minute', size: MINUTE },
  { limit: 90 * MINUTE, phrase: 'an hour' },
  { limit: 22 * HOUR, unit: 'hour', size: HOUR },
  { limit: 36 * HOUR, phrase: 'a day' },
  { limit: 26 * DAY, unit: 'day', size: DAY },
  { limit: 45 * DAY, phrase: 'a month' },
  { limit: 320 * DAY, unit: 'month', size: MONTH },
  { limit: 548 * DAY, phrase: 'a year' },
  { limit: Infinity, unit: 'year', size: YEAR }
]

function parseDate (input) {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isFinite(date.getTime()) ? date : null
}

function getRelativeTimePhrase (absoluteMs) {
  const threshold = RELATIVE_TIME_THRESHOLDS.find(candidate => absoluteMs < candidate.limit)
  if (threshold.phrase) return threshold.phrase

  const value = Math.max(1, Math.round(absoluteMs / threshold.size))
  return `${value} ${threshold.unit}${value === 1 ? '' : 's'}`
}

export function formatRelativeTime (input, baseInput = new Date()) {
  const date = parseDate(input)
  const baseDate = parseDate(baseInput)

  if (!date || !baseDate) return ''

  const diffMs = date.getTime() - baseDate.getTime()
  const phrase = getRelativeTimePhrase(Math.abs(diffMs))

  return diffMs > 0 ? `in ${phrase}` : `${phrase} ago`
}
