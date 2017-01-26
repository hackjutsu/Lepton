'use strict'

/* [my_title] my_description #keywords: key1, key2, key3
   This method will parse the string formatted above into an object formatted as
   {
     title: 'my_title',
     description: 'my_description',
     keywords: '#keywords: key1, key2, key3'
   } */
export default function parser (rawDescription = 'AWESOME GIST') {
  let regexForTitle = rawDescription.match(/\[.*\]/)
  let rawTitle = regexForTitle && regexForTitle[0] || ''
  let title = (rawTitle.length > 0) && rawTitle.substring(1, regexForTitle[0].length-1) || ''

  let regextForKeywords = rawDescription.match(/#keywords:.*$/)
  let keywords = regextForKeywords && regextForKeywords[0] || ''

  let description = rawDescription.substring(rawTitle.length, rawDescription.length - keywords.length)

  return { title, description, keywords }
}
