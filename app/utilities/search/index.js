'use strict'
const Elasticlunr = require('elasticlunr')

let index = null

function resetIndex () {
  index = Elasticlunr()
  index.addField('description')
}

function addToIndex (item) {
  if (!item) return
  index.addDoc(item)
}

function removeFromIndex (item) {
  if (!item) return
  index.removeDoc(item)
}

function updateToIndex (item) {
  if (!item) return
  index.updateDoc(item)
}

function searchFromIndex (query) {
  if (!query) return
  return index.search(query, {
    fields: {
      description: { boost: 1 }
    }
  })
}

module.exports = {
  resetIndex: resetIndex,
  addToIndex: addToIndex,
  removeFromIndex: removeFromIndex,
  updateToIndex: updateToIndex,
  searchFromIndex: searchFromIndex
}
