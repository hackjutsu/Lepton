'use strict'

export default function parser (rawDescription) {
  let regexForTitle = rawDescription.match(/\[.*\]/)
  let rawTitle = regexForTitle && regexForTitle[0] || ''
  let title = (rawTitle.length > 0) && rawTitle.substring(1, regexForTitle[0].length-1) || ''

  let regextForKeywords = rawDescription.match(/#keywords:.*$/)
  let keywords = regextForKeywords && regextForKeywords[0] || ''

  let description = rawDescription.substring(rawTitle.length, rawDescription.length - keywords.length)

  return {
    title: title,
	description: description,
	keywords: keywords
  }
}
