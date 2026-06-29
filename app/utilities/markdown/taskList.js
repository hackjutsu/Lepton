const taskListItemPattern = /^(\s*(?:[-+*]|\d+[.)])\s+\[)([ xX])(\]\s+)/

export function toggleMarkdownTaskListItem (content, taskIndex, checked) {
  if (taskIndex < 0) return content

  let currentTaskIndex = -1
  const lineParts = content.split(/(\r\n|\n|\r)/)

  for (let idx = 0; idx < lineParts.length; idx += 2) {
    const line = lineParts[idx]
    if (!taskListItemPattern.test(line)) continue

    currentTaskIndex += 1
    if (currentTaskIndex !== taskIndex) continue

    lineParts[idx] = line.replace(taskListItemPattern, `$1${checked ? 'x' : ' '}$3`)
    return lineParts.join('')
  }

  return content
}
