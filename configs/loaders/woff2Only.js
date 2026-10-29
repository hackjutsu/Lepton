// Electron supports WOFF2. Keep fallback formats only for font faces that do
// not provide WOFF2, rather than bundling multiple copies of the same font.
module.exports = function woff2Only (source) {
  return source.replace(/@font-face\s*\{[^}]*\}/gi, face => {
    const sources = [...face.matchAll(/\bsrc\s*:\s*([^;}]+)(?:;|(?=\}))/gi)]
    const woff2 = sources.flatMap(match => match[1].split(','))
      .find(value => /format\(\s*(['"]?)woff2\1\s*\)/i.test(value))

    if (!woff2) return face

    let replaced = false
    return face.replace(/\bsrc\s*:\s*[^;}]+(?:;|(?=\}))/gi, () => {
      if (replaced) return ''
      replaced = true
      return `src: ${woff2.trim()};`
    })
  })
}
