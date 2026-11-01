module.exports = function (source) {
  const original = 'var root = this || globalThis;'
  if (!source.includes(original)) throw new Error('Unexpected notebookjs source; cannot adapt browser root')
  return source.replace(original, 'var root = globalThis;')
}
