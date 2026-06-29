import { parseCustomTags } from '../../utilities/parser'

const tagColorClasses = [
  'tag-badge-color-0',
  'tag-badge-color-1',
  'tag-badge-color-2',
  'tag-badge-color-3',
  'tag-badge-color-4',
  'tag-badge-color-5'
]

export function getTagColorClass (tag) {
  const hash = tag.split('').reduce((memo, char) => {
    return ((memo << 5) - memo) + char.charCodeAt(0)
  }, 0)
  const index = ((hash % tagColorClasses.length) + tagColorClasses.length) % tagColorClasses.length
  return tagColorClasses[index]
}

export function getRegularTagsForGist (gistId, customTags, gistTags) {
  const seenTags = new Set()
  const tags = []
  const pushTag = tag => {
    const label = (tag || '').trim()
    const normalizedLabel = label.toLowerCase()
    if (label.length === 0 || seenTags.has(normalizedLabel)) {
      return
    }

    seenTags.add(normalizedLabel)
    tags.push(label)
  }

  parseCustomTags(customTags).forEach(pushTag)
  Object.keys(gistTags || {})
    .filter(tag => !tag.startsWith('lang@'))
    .filter(tag => Array.isArray(gistTags[tag]) && gistTags[tag].includes(gistId))
    .sort()
    .forEach(pushTag)

  return tags
}
