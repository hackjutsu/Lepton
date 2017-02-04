'use strict'

/* [my_title] my_description #tags: tag1, tag2, tag3
   This method will parse the string formatted above into an object formatted as
   {
     title: 'my_title',
     description: 'my_description',
     tags: '#tags: tag1, tag2, tag3'
   } */
export function descriptionParser (payload) {
  const rawDescription = payload || 'No description'
  const regexForTitle = rawDescription.match(/\[.*\]/)
  const rawTitle = regexForTitle && regexForTitle[0] || ''
  const title = (rawTitle.length > 0) && rawTitle.substring(1, regexForTitle[0].length - 1) || ''

  const regextForCustomTags = rawDescription.match(/#tags:.*$/)
  const customTags = regextForCustomTags && regextForCustomTags[0] || ''

  const description = rawDescription.substring(rawTitle.length, rawDescription.length - customTags.length)

  return { title, description, customTags }
}

export function addLangPrefix (payload) {
  const lang = payload || 'Other'
  const prefix = 'lang@'
  return lang.trim().length > 0
    ? prefix + lang.trim()
    : lang
}

export function parseLangName (payload) {
  const rawlangTag = payload || 'lang@Other'
  const prefix = 'lang@'
  if (!rawlangTag.startsWith(prefix)) return rawlangTag
  return rawlangTag.substring(prefix.length)
}

export function addCustomTagsPrefix (tags) {
  const prefix = '#tags:'
  return tags.trim().length > 0
    ? prefix + tags.trim()
    : tags
}

export function parseCustomTags (payload) {
  const rawTags = payload || '#tags:'
  const prefix = '#tags:'
  if (!rawTags.trim().startsWith(prefix)) return []
  const processedTags = rawTags.trim().substring(prefix.length)
  const splitTags = processedTags.split(/[,，、]/).map(item => item.trim()).filter(item => item.length > 0)
  return splitTags
}
