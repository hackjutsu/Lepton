export function cloneSnippetTagMap (source) {
  const tagMap = Object.create(null)

  Object.keys(source || {}).forEach(tag => {
    tagMap[tag] = Array.isArray(source[tag]) ? source[tag].slice() : []
  })

  return tagMap
}
