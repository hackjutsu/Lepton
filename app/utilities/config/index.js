function shouldDownloadAllSnippets (conf) {
  if (!conf || typeof conf.get !== 'function') {
    return false
  }

  return Boolean(conf.get('snippet:downloadAll') || conf.get('gist:downloadAll'))
}

module.exports = {
  shouldDownloadAllSnippets
}
