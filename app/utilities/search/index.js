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



// let doc1 = {
//     "id": "122313123",
//     "title": "Oracle released its latest database Oracle 12g",
//     "body": "Yestaday Oracle has released its new database Oracle 12g, this would make more money for this company and lead to a nice profit report of annual year."
// }
//
// let doc2 = {
//     "id": 2,
//     "title": "Oracle released its profit report of 2015",
//     "body": "As expected, Oracle released its profit report of 2015, during the good sales of database and hardware, Oracle's profit of 2015 reached 12.5 Billion."
// }



// let results = index.search("Oracle database profit")
// results.forEach(item => {
//   // console.log(index.documentStore(item.ref))
// })
// console.log(results)
