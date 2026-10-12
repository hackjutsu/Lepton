import { addLangPrefix as Prefixed } from './parser'

export const ALL_GIST_LANGUAGE = Prefixed('All')

export function createDefaultGistFilters () {
  return {
    language: ALL_GIST_LANGUAGE,
    tags: []
  }
}

export function normalizeGistFilters (filters) {
  const language = filters && typeof filters.language === 'string'
    ? filters.language
    : ALL_GIST_LANGUAGE
  const tags = filters && Array.isArray(filters.tags)
    ? [...new Set(filters.tags.filter(tag => typeof tag === 'string' && !tag.startsWith('lang@')))]
    : []

  return { language, tags }
}

export function pruneGistFilters (filters, gistTags) {
  if (!gistTags) return createDefaultGistFilters()

  const normalizedFilters = normalizeGistFilters(filters)
  const language = gistTags[normalizedFilters.language]
    ? normalizedFilters.language
    : ALL_GIST_LANGUAGE
  const tags = normalizedFilters.tags.filter(tag => Array.isArray(gistTags[tag]))

  return { language, tags }
}

export function areGistFiltersEqual (left, right) {
  const normalizedLeft = normalizeGistFilters(left)
  const normalizedRight = normalizeGistFilters(right)

  return normalizedLeft.language === normalizedRight.language &&
    normalizedLeft.tags.length === normalizedRight.tags.length &&
    normalizedLeft.tags.every((tag, index) => tag === normalizedRight.tags[index])
}

export function getFilteredGistIds (gistTags, filters) {
  if (!gistTags) return []

  const normalizedFilters = normalizeGistFilters(filters)
  const allGistIds = gistTags[ALL_GIST_LANGUAGE]
  if (!Array.isArray(allGistIds)) return []

  const filterGistIds = normalizedFilters.tags.map(tag => new Set(gistTags[tag] || []))
  if (normalizedFilters.language !== ALL_GIST_LANGUAGE) {
    filterGistIds.unshift(new Set(gistTags[normalizedFilters.language] || []))
  }
  const seenGistIds = new Set()

  return allGistIds.filter(gistId => {
    if (seenGistIds.has(gistId)) return false
    seenGistIds.add(gistId)
    return filterGistIds.every(ids => ids.has(gistId))
  })
}

export function getActiveGistIdForFilters (gistTags, filters, activeGist) {
  const filteredGistIds = getFilteredGistIds(gistTags, filters)
  return filteredGistIds.includes(activeGist)
    ? activeGist
    : filteredGistIds[0] || null
}
