'use strict'
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
    'description',
    'language'
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
  let newIndex = fuseIndex.filter(gist => {
    return gist.id !== item.id
  })
  newIndex.push(item)
  fuseIndex = newIndex
}

function fuseSearch (pattern) {
  return fuse.search(pattern.trim() || '')
}

module.exports = {
  resetFuseIndex: resetFuseIndex,
  updateFuseIndex: updateFuseIndex,
  addToFuseIndex: addToFuseIndex,
  initFuseSearch: initFuseSearch,
  fuseSearch: fuseSearch
}
