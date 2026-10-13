import validFilename from 'valid-filename'

export function isValidSnippetFilePath (value, providerType = 'github') {
  if (typeof value !== 'string') return false

  if (String(providerType).toLowerCase() !== 'gitlab') {
    return validFilename(value)
  }

  const pathSegments = value.split('/')

  return pathSegments.length > 0 &&
    pathSegments.every(segment => validFilename(segment))
}
