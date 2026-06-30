const {
  buildSearchRecord,
  createHighlightedExcerpt,
  normalizeFuseResult
} = require('./records')

let fuseIndex = []

const SEARCH_FIELD_PRIORITY = {
  description: 1,
  filename: 2,
  'files.filename': 2,
  language: 3,
  'files.language': 3,
  id: 4,
  'files.content': 5
}

function resetFuseIndex (list) {
  fuseIndex = list
}

function initFuseSearch () {
  // Kept for compatibility with existing callers. The exact-match index is
  // maintained incrementally by resetFuseIndex/addToFuseIndex/updateFuseIndex.
}

function addToFuseIndex (item) {
  fuseIndex.push(item)
}

function updateFuseIndex (item) {
  const newIndex = fuseIndex.filter(gist => {
    return gist.id !== item.id
  })
  newIndex.push(item)
  fuseIndex = newIndex
}

function normalizeSearchValue (value) {
  if (value === null || typeof value === 'undefined') return ''
  return String(value)
}

function getSearchTokens (pattern) {
  return pattern.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function getRecordSearchFields (record) {
  const fields = [
    { key: 'description', value: normalizeSearchValue(record.description) },
    { key: 'filename', value: normalizeSearchValue(record.filename) },
    { key: 'language', value: normalizeSearchValue(record.language) },
    { key: 'id', value: normalizeSearchValue(record.id) }
  ]

  if (Array.isArray(record.files)) {
    record.files.forEach((file, arrayIndex) => {
      fields.push({
        key: 'files.filename',
        value: normalizeSearchValue(file.filename),
        arrayIndex: arrayIndex
      })
      fields.push({
        key: 'files.language',
        value: normalizeSearchValue(file.language),
        arrayIndex: arrayIndex
      })
      fields.push({
        key: 'files.content',
        value: normalizeSearchValue(file.content),
        arrayIndex: arrayIndex
      })
    })
  }

  return fields.filter(field => field.value.length > 0)
}

function findTokenIndices (value, token) {
  const lowerValue = value.toLowerCase()
  const indices = []
  let searchStart = 0
  let matchStart = lowerValue.indexOf(token, searchStart)

  while (matchStart !== -1) {
    indices.push([matchStart, matchStart + token.length - 1])
    searchStart = matchStart + token.length
    matchStart = lowerValue.indexOf(token, searchStart)
  }

  return indices
}

function mergeIndices (indices) {
  const sortedIndices = indices.slice().sort((left, right) => left[0] - right[0])
  return sortedIndices.reduce((merged, current) => {
    const previous = merged[merged.length - 1]
    if (!previous || current[0] > previous[1] + 1) {
      merged.push(current)
      return merged
    }

    previous[1] = Math.max(previous[1], current[1])
    return merged
  }, [])
}

function getBestMatch (matches) {
  return matches.slice().sort((left, right) => {
    const leftPriority = SEARCH_FIELD_PRIORITY[left.key] || 99
    const rightPriority = SEARCH_FIELD_PRIORITY[right.key] || 99
    if (leftPriority !== rightPriority) return leftPriority - rightPriority

    const leftIndex = left.indices && left.indices.length ? left.indices[0][0] : Number.MAX_SAFE_INTEGER
    const rightIndex = right.indices && right.indices.length ? right.indices[0][0] : Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })[0]
}

function buildExactSearchResult (record, tokens, index) {
  const matchedTokens = new Set()
  const matches = []

  getRecordSearchFields(record).forEach(field => {
    const fieldIndices = []
    tokens.forEach((token, tokenIndex) => {
      const tokenIndices = findTokenIndices(field.value, token)
      if (tokenIndices.length === 0) return

      matchedTokens.add(tokenIndex)
      fieldIndices.push(...tokenIndices)
    })

    if (fieldIndices.length > 0) {
      matches.push({
        key: field.key,
        value: field.value,
        indices: mergeIndices(fieldIndices),
        arrayIndex: field.arrayIndex
      })
    }
  })

  if (matchedTokens.size !== tokens.length) return null

  const bestMatch = getBestMatch(matches)
  const priority = SEARCH_FIELD_PRIORITY[bestMatch.key] || 99
  const matchStart = bestMatch.indices && bestMatch.indices.length ? bestMatch.indices[0][0] : 0

  return {
    result: normalizeFuseResult({
      item: record,
      score: priority + (matchStart / 100000),
      matches: matches
    }),
    rank: [priority, matchStart, index]
  }
}

function compareSearchResults (left, right) {
  for (let i = 0; i < left.rank.length; i++) {
    if (left.rank[i] !== right.rank[i]) return left.rank[i] - right.rank[i]
  }
  return 0
}

function fuseSearch (pattern) {
  const trimmedPattern = pattern.trim()
  if (!trimmedPattern || trimmedPattern.length <= 1) return []

  const tokens = getSearchTokens(trimmedPattern)
  return fuseIndex
    .map((record, index) => buildExactSearchResult(record, tokens, index))
    .filter(result => result !== null)
    .sort(compareSearchResults)
    .map(result => result.result)
}

module.exports = {
  resetFuseIndex: resetFuseIndex,
  updateFuseIndex: updateFuseIndex,
  addToFuseIndex: addToFuseIndex,
  initFuseSearch: initFuseSearch,
  fuseSearch: fuseSearch,
  buildSearchRecord: buildSearchRecord,
  createHighlightedExcerpt: createHighlightedExcerpt
}
