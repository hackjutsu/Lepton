// Small snippets can grow with their content. Large documents need a bounded
// viewport so CodeMirror only creates DOM for the visible lines.
export function needsBoundedViewport (value = '') {
  if (value.length > 20000) return true

  let lines = 1
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) === 10 && ++lines > 200) return true
  }
  return false
}
