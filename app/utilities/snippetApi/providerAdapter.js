function createProviderAdapter (type, requests) {
  if (typeof type !== 'string' || !type) {
    throw new Error('Snippet provider adapter requires a type')
  }

  const handlers = Object.keys(requests || {}).reduce((result, operation) => {
    if (typeof requests[operation] === 'function') {
      result[operation] = requests[operation]
    }
    return result
  }, Object.create(null))

  return Object.freeze({
    type,
    getRequest: operation => handlers[operation]
  })
}

module.exports = { createProviderAdapter }
