export function buildGistFilesPatch (gistFiles, existingFiles) {
  const processedFiles = {}
  const retainedFilenames = new Set()

  ;(gistFiles || []).forEach(file => {
    const filename = file.filename.trim()
    if (file._nativeBinary) {
      retainedFilenames.add(file._originalFilename || filename)
      return
    }

    retainedFilenames.add(filename)
    processedFiles[filename] = {
      content: file.content
    }
  })

  Object.keys(existingFiles || {}).forEach(filename => {
    if (!retainedFilenames.has(filename)) processedFiles[filename] = null
  })

  return processedFiles
}
