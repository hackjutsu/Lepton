import SearchIndex from '../../../app/utilities/search'

let query = ''
let cachedResults
const listeners = new Set()
const selectionListeners = new Set()

export function currentSearchQuery () { return query }

export function setSearchQuery (value) {
  if (query === value) return
  query = value
  listeners.forEach(listener => listener(query))
}

export function subscribeSearchQuery (listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function announceSearchSelection (id) { selectionListeners.forEach(listener => listener(id)) }
export function subscribeSearchSelection (listener) {
  selectionListeners.add(listener)
  return () => selectionListeners.delete(listener)
}

export function matchingSearchResults (input, gists) {
  const trimmed = input.trim()
  if (!trimmed) return []
  if (!cachedResults || cachedResults.query !== trimmed || cachedResults.gists !== gists) {
    cachedResults = { query: trimmed, gists, results: SearchIndex.fuseSearch(trimmed).filter(result => gists[result.id]) }
  }
  return cachedResults.results
}

// Match the exact, case-insensitive tokens used by the search index.
export function searchRanges (value, input) {
  const trimmed = input.trim()
  if (!value || trimmed.length <= 1) return []
  const lower = value.toLowerCase()
  const ranges = []
  for (const token of trimmed.toLowerCase().split(/\s+/).filter(Boolean)) {
    for (let start = lower.indexOf(token); start !== -1; start = lower.indexOf(token, start + token.length)) {
      ranges.push([start, start + token.length])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  return ranges.reduce((merged, range) => {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push(range)
    return merged
  }, [])
}

// CodeArea and the linked description use dangerouslySetInnerHTML; their
// descendants are not React-managed. Preserve links, checkboxes and images.
export function highlightRenderedText (root, input) {
  if (!root) return
  for (const mark of root.querySelectorAll('mark[data-lepton-search]')) {
    const parent = mark.parentNode
    mark.replaceWith(document.createTextNode(mark.textContent))
    parent.normalize()
  }
  if (input.trim().length <= 1) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement?.closest('script, style, button, .lepton-markdown-image-placeholder')
      ? NodeFilter.FILTER_REJECT
      : NodeFilter.FILTER_ACCEPT
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    const text = node.nodeValue
    const ranges = searchRanges(text, input)
    if (!ranges.length) continue
    const fragment = document.createDocumentFragment()
    let offset = 0
    for (const [start, end] of ranges) {
      if (start > offset) fragment.appendChild(document.createTextNode(text.slice(offset, start)))
      const mark = document.createElement('mark')
      mark.className = 'detail-search-match'
      mark.dataset.leptonSearch = 'true'
      mark.textContent = text.slice(start, end)
      fragment.appendChild(mark)
      offset = end
    }
    if (offset < text.length) fragment.appendChild(document.createTextNode(text.slice(offset)))
    node.replaceWith(fragment)
  }
}
