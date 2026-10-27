// Backward-compatible import path. Shared transport belongs to snippetApi.
const sharedFetchAdapter = require('../snippetApi/fetchAdapter')

function createFetchRequest (fetchImpl, options = {}) {
  return sharedFetchAdapter.createFetchRequest(fetchImpl, Object.assign({
    serviceName: 'GitHub'
  }, options))
}

module.exports = {
  createElectronFetchImpl: sharedFetchAdapter.createElectronFetchImpl,
  createFetchRequest
}
