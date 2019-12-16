const Fuse = require('fuse.js')

let fuse = null
let fuseIndex = []

const fuseOptions = {
  shouldSort: true,
  tokenize: true,
  matchAllTokens: true,
  findAllMatches: true,
  threshold: 0.2,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  keys: [
    'id',
    'description',
    'language',
    'filename'
  ]
}

function resetFuseIndex (list) {
  fuseIndex = list
}

function initFuseSearch () {
  fuse = new Fuse(fuseIndex, fuseOptions)
}

function addToFuseIndex (item) {
  fuseIndex.push(item)
}

function updateFuseIndex (item) {
  const newIndex = fuseIndex.filter(gist => {
    return gist.id !== item.id
  })
  newIndex.push(item)
  fuseIndex = newIndex
}

function fuseSearch (pattern) {
  const trimmedPattern = pattern.trim()
  if (!trimmedPattern || trimmedPattern.length <= 1) return []

  return fuse.search(trimmedPattern)
}

module.exports = {
  resetFuseIndex: resetFuseIndex,
  updateFuseIndex: updateFuseIndex,
  addToFuseIndex: addToFuseIndex,
  initFuseSearch: initFuseSearch,
  fuseSearch: fuseSearch
}
