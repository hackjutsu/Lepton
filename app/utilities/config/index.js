function getBooleanConfig (conf, key) {
  return Boolean(conf && conf.get(key))
}

function downloadAllSnippets (conf) {
  return getBooleanConfig(conf, 'snippet:downloadAll')
}

module.exports = {
  downloadAllSnippets
}
