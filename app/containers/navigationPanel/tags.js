import {
  ALL_GIST_LANGUAGE,
  normalizeGistFilters
} from '../../utilities/gistFilters'

export function getNextActiveGistFilters (
  clickedTag,
  activeGistFilters,
  { extendSelection = false } = {}
) {
  const filters = normalizeGistFilters(activeGistFilters)

  if (clickedTag.startsWith('lang@')) {
    return Object.assign({}, filters, {
      language: clickedTag === filters.language && clickedTag !== ALL_GIST_LANGUAGE
        ? ALL_GIST_LANGUAGE
        : clickedTag
    })
  }

  let tags
  if (extendSelection) {
    tags = filters.tags.includes(clickedTag)
      ? filters.tags.filter(tag => tag !== clickedTag)
      : [...filters.tags, clickedTag]
  } else {
    tags = filters.tags.length === 1 && filters.tags[0] === clickedTag
      ? []
      : [clickedTag]
  }

  return Object.assign({}, filters, { tags })
}

export function isGistFilterActive (tag, activeGistFilters) {
  const filters = normalizeGistFilters(activeGistFilters)
  return tag.startsWith('lang@')
    ? filters.language === tag
    : filters.tags.includes(tag)
}
