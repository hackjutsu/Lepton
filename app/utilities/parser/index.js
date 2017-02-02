'use strict'

/* [my_title] my_description #keywords: key1, key2, key3
   This method will parse the string formatted above into an object formatted as
   {
     title: 'my_title',
     description: 'my_description',
     keywords: '#keywords: key1, key2, key3'
   } */
export function descriptionParser (rawDescription = 'AWESOME GIST') {
  let regexForTitle = rawDescription.match(/\[.*\]/)
  let rawTitle = regexForTitle && regexForTitle[0] || ''
  let title = (rawTitle.length > 0) && rawTitle.substring(1, regexForTitle[0].length-1) || ''

  let regextForKeywords = rawDescription.match(/#keywords:.*$/)
  let keywords = regextForKeywords && regextForKeywords[0] || ''

  let description = rawDescription.substring(rawTitle.length, rawDescription.length - keywords.length)

  return { title, description, keywords }
}

export function addLangPrefix (lang) {
  let prefix = 'lang@'
  return lang.trim().length > 0
    ? prefix + lang.trim()
	: lang
}

export function parseLangName (rawlangTag) {
  if (!rawlangTag.startsWith('lang@')) return rawlangTag
  return rawlangTag.substring(5)
}

export function addKeywordsPrefix (keywords) {
  let prefix = '#keywords:'
  return keywords.trim().length > 0
    ? prefix + keywords.trim()
	: keywords
}

export function parseKeywords(rawKeywords) {
  if (!rawKeywords.trim().startsWith('#keywords:')) return []
  let processedKeywords = rawKeywords.trim().substring(10)
  let splitKeywords = processedKeywords.split(/[,，、]/).map(item => item.trim()).filter(item => item.length>0)
  return splitKeywords
}
