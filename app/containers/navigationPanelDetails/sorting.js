export function getSortableValue (gist, sortingKey) {
  const value = gist && gist.brief ? gist.brief[sortingKey] : ''
  return value === null || value === undefined ? '' : String(value)
}

export function compareGists (sortingKey, sortingReverse) {
  return (g1, g2) => {
    const firstValue = getSortableValue(g1, sortingKey)
    const secondValue = getSortableValue(g2, sortingKey)

    if (sortingReverse) {
      return secondValue.localeCompare(firstValue)
    }
    return firstValue.localeCompare(secondValue)
  }
}
