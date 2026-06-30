const DEFAULT_EXCERPT_LENGTH = 140
const EXCERPT_CONTEXT_LENGTH = 32

const MATCH_KEY_LABELS = {
  id: 'ID',
  description: 'Description',
  language: 'Language',
  filename: 'File name',
  'files.filename': 'File name',
  'files.language': 'Language',
  'files.content': 'Content'
}

const MATCH_KEY_PRIORITY = {
  description: 1,
  filename: 2,
  'files.filename': 2,
  language: 3,
  'files.language': 3,
  id: 4,
  'files.content': 5
}

function toGistBrief (gist) {
  if (!gist) return {}
  return gist.brief || gist
}

function toGistDetails (gist, detailsOverride) {
  if (detailsOverride) return detailsOverride
  if (!gist) return null
  return gist.details || null
}

function normalizeFileEntries (files) {
  if (!files) return []

  return Object.keys(files).map(filename => {
    const file = files[filename] || {}
    return Object.assign({}, file, {
      filename: file.filename || filename
    })
  })
}

function getUniqueLanguages (fileEntries) {
  const languages = new Set()
  fileEntries.forEach(file => {
    languages.add(file.language || 'Other')
  })
  return [...languages]
}

function buildSearchRecord (gist, detailsOverride) {
  const brief = toGistBrief(gist)
  const details = toGistDetails(gist, detailsOverride)
  const source = details || brief
  const filesSource = source.files || brief.files || {}
  const fileEntries = normalizeFileEntries(filesSource)
  const filenames = fileEntries.map(file => file.filename).filter(Boolean)
  const languages = getUniqueLanguages(fileEntries)
  const searchableFiles = fileEntries
    .filter(file => typeof file.content === 'string' && file.content.length > 0)
    .map(file => ({
      filename: file.filename,
      language: file.language || 'Other',
      content: file.content
    }))

  return {
    id: source.id || brief.id,
    description: source.description || brief.description || '',
    updated_at: source.updated_at || brief.updated_at || '',
    language: languages.join(','),
    filename: filenames.join(', '),
    files: searchableFiles
  }
}

function buildExcerptBounds (value, indices, maxLength) {
  const firstMatch = indices && indices.length > 0 ? indices[0] : [0, 0]
  const matchStart = firstMatch[0]
  const matchEnd = firstMatch[1]
  const matchLength = matchEnd - matchStart + 1
  const contextLength = Math.min(EXCERPT_CONTEXT_LENGTH, Math.floor(Math.max(0, maxLength - matchLength) / 2))
  const start = Math.max(0, matchStart - contextLength)
  const end = Math.min(value.length, matchEnd + 1 + contextLength)

  return { start, end }
}

function normalizeExcerptText (value) {
  return value.replace(/\s+/g, ' ')
}

function createHighlightedSegments (value, indices) {
  if (!value) return []

  const segments = []
  let cursor = 0
  const segmentIndices = (indices || [])
    .slice()
    .sort((left, right) => left[0] - right[0])

  segmentIndices.forEach(([start, end]) => {
    if (start > cursor) {
      segments.push({
        text: value.slice(cursor, start),
        match: false
      })
    }
    segments.push({
      text: value.slice(start, end + 1),
      match: true
    })
    cursor = end + 1
  })

  if (cursor < value.length) {
    segments.push({
      text: value.slice(cursor),
      match: false
    })
  }

  return segments.filter(segment => segment.text.length > 0)
}

function createHighlightedExcerpt (value, indices, maxLength = DEFAULT_EXCERPT_LENGTH) {
  if (!value) {
    return {
      text: '',
      segments: []
    }
  }

  const bounds = buildExcerptBounds(value, indices || [], maxLength)
  const excerptText = value.slice(bounds.start, bounds.end)
  const segments = []

  if (bounds.start > 0) {
    segments.push({ text: '...', match: false })
  }

  let cursor = bounds.start
  const excerptIndices = (indices || [])
    .filter(([start, end]) => end >= bounds.start && start < bounds.end)
    .map(([start, end]) => [
      Math.max(start, bounds.start),
      Math.min(end + 1, bounds.end)
    ])
    .sort((left, right) => left[0] - right[0])

  excerptIndices.forEach(([start, end]) => {
    if (start > cursor) {
      segments.push({
        text: normalizeExcerptText(value.slice(cursor, start)),
        match: false
      })
    }
    segments.push({
      text: normalizeExcerptText(value.slice(start, end)),
      match: true
    })
    cursor = end
  })

  if (cursor < bounds.end) {
    segments.push({
      text: normalizeExcerptText(value.slice(cursor, bounds.end)),
      match: false
    })
  }

  if (bounds.end < value.length) {
    segments.push({ text: '...', match: false })
  }

  return {
    text: normalizeExcerptText(excerptText),
    segments: segments.filter(segment => segment.text.length > 0)
  }
}

function getMatchedFile (record, match) {
  if (!match || !match.key || !match.key.startsWith('files.')) return null
  if (typeof match.arrayIndex !== 'number') return null
  if (!record.files || !record.files[match.arrayIndex]) return null
  return record.files[match.arrayIndex]
}

function buildSearchMatch (record, match) {
  const key = match.key
  const matchedFile = getMatchedFile(record, match)
  const isContentMatch = key === 'files.content'
  const baseLabel = MATCH_KEY_LABELS[key] || key
  const fileLabel = matchedFile && matchedFile.filename
    ? `${baseLabel} in ${matchedFile.filename}`
    : baseLabel

  return {
    key: key,
    label: fileLabel,
    filename: matchedFile ? matchedFile.filename : null,
    language: matchedFile ? matchedFile.language : null,
    segments: createHighlightedSegments(match.value, match.indices),
    excerpt: isContentMatch
      ? createHighlightedExcerpt(match.value, match.indices)
      : null
  }
}

function compareMatches (left, right) {
  const leftPriority = MATCH_KEY_PRIORITY[left.key] || 99
  const rightPriority = MATCH_KEY_PRIORITY[right.key] || 99
  if (leftPriority !== rightPriority) return leftPriority - rightPriority

  const leftIndex = left.indices && left.indices.length ? left.indices[0][0] : Number.MAX_SAFE_INTEGER
  const rightIndex = right.indices && right.indices.length ? right.indices[0][0] : Number.MAX_SAFE_INTEGER
  return leftIndex - rightIndex
}

function buildSearchMeta (record, fuseResult) {
  const rawMatches = fuseResult.matches || []
  const matches = rawMatches
    .slice()
    .sort(compareMatches)
    .map(match => buildSearchMatch(record, match))

  return {
    score: fuseResult.score,
    matches: matches,
    bestMatch: matches[0] || null
  }
}

function normalizeFuseResult (fuseResult) {
  if (!fuseResult || !fuseResult.item) return fuseResult

  const record = fuseResult.item
  return Object.assign({}, record, {
    searchMeta: buildSearchMeta(record, fuseResult)
  })
}

module.exports = {
  buildSearchRecord: buildSearchRecord,
  createHighlightedSegments: createHighlightedSegments,
  createHighlightedExcerpt: createHighlightedExcerpt,
  normalizeFuseResult: normalizeFuseResult
}
