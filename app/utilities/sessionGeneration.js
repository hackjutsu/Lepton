let activeGeneration = 0

export function advanceSessionGeneration () {
  activeGeneration += 1
  return activeGeneration
}

export function getSessionGeneration () {
  return activeGeneration
}

export function isSessionGenerationCurrent (generation) {
  return generation === activeGeneration
}

export function createStaleSessionError () {
  const error = new Error('The snippet session changed while the request was in progress.')
  error.code = 'STALE_SNIPPET_SESSION'
  return error
}

export function assertSessionGenerationCurrent (generation) {
  if (!isSessionGenerationCurrent(generation)) {
    throw createStaleSessionError()
  }
}

export function isStaleSessionError (error) {
  return Boolean(error && error.code === 'STALE_SNIPPET_SESSION')
}
