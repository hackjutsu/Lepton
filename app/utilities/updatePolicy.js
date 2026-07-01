const semverPattern = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

function parseVersion (version) {
  if (typeof version !== 'string') return null

  const match = semverPattern.exec(version.trim())
  if (!match) return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || ''
  }
}

function isStableVersion (version) {
  const parsed = parseVersion(version)
  return Boolean(parsed && !parsed.prerelease)
}

function compareVersions (left, right) {
  const parsedLeft = parseVersion(left)
  const parsedRight = parseVersion(right)
  if (!parsedLeft || !parsedRight) return null

  for (const field of ['major', 'minor', 'patch']) {
    if (parsedLeft[field] > parsedRight[field]) return 1
    if (parsedLeft[field] < parsedRight[field]) return -1
  }
  return 0
}

function getUpdateCheckDecision ({ autoUpdate, currentVersion, isDev }) {
  if (isDev) {
    return { reason: 'development build', shouldCheck: false }
  }

  if (autoUpdate !== true) {
    return { reason: 'autoUpdate disabled', shouldCheck: false }
  }

  if (!isStableVersion(currentVersion)) {
    return { reason: 'current version is not a stable release', shouldCheck: false }
  }

  return { reason: 'stable release with autoUpdate enabled', shouldCheck: true }
}

function getUpdateNotificationDecision ({ currentVersion, updateInfo }) {
  if (!isStableVersion(currentVersion)) {
    return { reason: 'current version is not a stable release', shouldNotify: false }
  }

  const nextVersion = updateInfo && updateInfo.version
  if (!isStableVersion(nextVersion)) {
    return { reason: 'candidate version is not a stable release', shouldNotify: false }
  }

  const comparison = compareVersions(nextVersion, currentVersion)
  if (comparison === null) {
    return { reason: 'candidate version could not be compared', shouldNotify: false }
  }

  if (comparison <= 0) {
    return { reason: 'candidate version is not newer', shouldNotify: false }
  }

  return { reason: 'candidate version is a newer stable release', shouldNotify: true }
}

module.exports = {
  compareVersions,
  getUpdateCheckDecision,
  getUpdateNotificationDecision,
  isStableVersion,
  parseVersion
}
