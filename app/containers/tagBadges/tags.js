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

export function shouldUseColoredTags (value) {
  return value !== false
}

function getConfigValue (conf, key, defaultValue) {
  if (!conf || typeof conf.get !== 'function') {
    return defaultValue
  }

  const value = conf.get(key)
  return value !== undefined ? value : defaultValue
}

export function shouldShowTagsInSnippetList (conf) {
  return getConfigValue(conf, 'tag:showInSnippetList', false) === true
}

export function shouldColorTags (conf) {
  return shouldUseColoredTags(getConfigValue(conf, 'tag:colored', true))
}

export function getTagBadgeClassName (tag, colored = true) {
  const classNames = ['tag-badge']
  if (colored) {
    classNames.push(getTagColorClass(tag))
  } else {
    classNames.push('tag-badge-plain')
  }
  return classNames.join(' ')
}

export function getTagBadgeLabel (tag, colored = true) {
  return colored ? tag : `#${tag}`
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
