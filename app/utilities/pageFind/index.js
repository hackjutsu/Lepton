const ACTIVE_HIGHLIGHT_NAME = 'lepton-find-active'
const MATCH_HIGHLIGHT_NAME = 'lepton-find-match'
const EXCLUDED_CONTENT_SELECTOR = [
  '.find-in-page',
  'script',
  'style',
  'noscript',
  'input',
  'textarea',
  'select',
  'option',
  '[hidden]',
  '[aria-hidden="true"]'
].join(',')

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isRangeVisible (documentRef, range) {
  if (typeof range.getBoundingClientRect !== 'function') return true
  const rect = range.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return false

  const windowRef = documentRef.defaultView
  const insideViewport = rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < windowRef.innerHeight &&
    rect.left < windowRef.innerWidth
  if (!insideViewport || typeof documentRef.elementFromPoint !== 'function') return true

  const x = Math.max(0, Math.min(windowRef.innerWidth - 1, rect.left + (rect.width / 2)))
  const y = Math.max(0, Math.min(windowRef.innerHeight - 1, rect.top + (rect.height / 2)))
  const hitTarget = documentRef.elementFromPoint(x, y)
  const parent = range.startContainer.parentElement
  return !hitTarget || hitTarget === parent || parent.contains(hitTarget) || hitTarget.contains(parent)
}

export function collectMatchRanges (documentRef, root, query) {
  if (!documentRef || !root || !query) return []

  const ranges = []
  const matcher = new RegExp(escapeRegExp(query), 'giu')
  const walker = documentRef.createTreeWalker(
    root,
    documentRef.defaultView.NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        const parent = node.parentElement
        if (!node.nodeValue || !parent || parent.closest(EXCLUDED_CONTENT_SELECTOR)) {
          return documentRef.defaultView.NodeFilter.FILTER_REJECT
        }
        return documentRef.defaultView.NodeFilter.FILTER_ACCEPT
      }
    }
  )

  let node = walker.nextNode()
  while (node) {
    matcher.lastIndex = 0
    let match = matcher.exec(node.nodeValue)
    while (match) {
      const range = documentRef.createRange()
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      ranges.push(range)
      match = matcher.exec(node.nodeValue)
    }
    node = walker.nextNode()
  }

  return ranges.filter(range => isRangeVisible(documentRef, range))
}

function scrollRangeIntoView (range, documentRef) {
  if (!range || !range.startContainer) return
  const element = range.startContainer.parentElement
  if (!element || typeof element.scrollIntoView !== 'function') return

  const rect = typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : null
  const viewportHeight = documentRef.defaultView.innerHeight || documentRef.documentElement.clientHeight
  const isVisible = rect && rect.top >= 0 && rect.bottom <= viewportHeight
  if (!isVisible) element.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function createPageFinder (documentRef = document) {
  const windowRef = documentRef.defaultView
  const highlightRegistry = windowRef.CSS && windowRef.CSS.highlights
  const HighlightConstructor = windowRef.Highlight
  let activeIndex = -1
  let ranges = []

  function clearHighlights () {
    if (!highlightRegistry) return
    highlightRegistry.delete(ACTIVE_HIGHLIGHT_NAME)
    highlightRegistry.delete(MATCH_HIGHLIGHT_NAME)
  }

  function result () {
    return {
      activeMatchOrdinal: activeIndex + 1,
      matches: ranges.length
    }
  }

  function applyHighlights (scroll = true) {
    if (!highlightRegistry || !HighlightConstructor || activeIndex < 0) return
    const inactiveRanges = ranges.filter((range, index) => index !== activeIndex)
    if (inactiveRanges.length > 0) {
      highlightRegistry.set(MATCH_HIGHLIGHT_NAME, new HighlightConstructor(...inactiveRanges))
    } else {
      highlightRegistry.delete(MATCH_HIGHLIGHT_NAME)
    }
    const activeHighlight = new HighlightConstructor(ranges[activeIndex])
    highlightRegistry.set(ACTIVE_HIGHLIGHT_NAME, activeHighlight)
    if (scroll) scrollRangeIntoView(ranges[activeIndex], documentRef)
  }

  return {
    clear () {
      clearHighlights()
      activeIndex = -1
      ranges = []
    },

    navigate (forward) {
      if (ranges.length === 0) return result()
      activeIndex = (activeIndex + (forward ? 1 : -1) + ranges.length) % ranges.length
      applyHighlights()
      return result()
    },

    search (query) {
      clearHighlights()
      ranges = collectMatchRanges(documentRef, documentRef.body, query)
      activeIndex = ranges.length > 0 ? 0 : -1

      if (highlightRegistry && HighlightConstructor && ranges.length > 0) {
        applyHighlights()
      }

      return result()
    }
  }
}

export { ACTIVE_HIGHLIGHT_NAME, MATCH_HIGHLIGHT_NAME }
