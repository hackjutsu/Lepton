const fs = require('fs')
const { execFileSync } = require('child_process')

const SEMVER_TAG_PATTERN = /^v?([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z.-]+))?$/
const BETA_PRERELEASE_PATTERN = /^beta\.([0-9]+)$/

function parseSemverTag (tagName) {
  if (typeof tagName !== 'string') return null

  const match = SEMVER_TAG_PATTERN.exec(tagName.trim())
  if (!match) return null

  const prerelease = match[4] || ''
  return {
    tagName,
    version: `${match[1]}.${match[2]}.${match[3]}${prerelease ? `-${prerelease}` : ''}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    prereleaseParts: prerelease ? prerelease.split('.') : []
  }
}

function compareIdentifiers (left, right) {
  const leftNumeric = /^[0-9]+$/.test(left)
  const rightNumeric = /^[0-9]+$/.test(right)

  if (leftNumeric && rightNumeric) return Number(left) - Number(right)
  if (leftNumeric) return -1
  if (rightNumeric) return 1

  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareParsedVersions (left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }

  if (!left.prerelease && !right.prerelease) return 0
  if (!left.prerelease) return 1
  if (!right.prerelease) return -1

  const length = Math.max(left.prereleaseParts.length, right.prereleaseParts.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prereleaseParts[index]
    const rightPart = right.prereleaseParts[index]

    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1

    const comparison = compareIdentifiers(leftPart, rightPart)
    if (comparison !== 0) return comparison
  }

  return 0
}

function normalizeRelease (release) {
  if (!release || release.isDraft) return null

  const version = parseSemverTag(release.tagName)
  if (!version) return null

  return {
    ...release,
    version
  }
}

function getSemverReleases (releases) {
  return releases
    .map(normalizeRelease)
    .filter(Boolean)
}

function getLatestRelease (releases) {
  return [...releases].sort((left, right) => (
    compareParsedVersions(right.version, left.version)
  ))[0] || null
}

function getPreviousReleaseTag (releases, currentTag) {
  return getLatestRelease(getSemverReleases(releases).filter(release => (
    release.tagName !== currentTag
  )))?.tagName || ''
}

function getNextBetaVersion (latestRelease) {
  if (!latestRelease) {
    throw new Error('No non-draft semver GitHub releases were found.')
  }

  const { major, minor, patch, prerelease } = latestRelease.version
  if (!prerelease) {
    return `${major}.${minor}.${patch + 1}-beta.1`
  }

  const betaMatch = BETA_PRERELEASE_PATTERN.exec(prerelease)
  if (!betaMatch) {
    throw new Error(`Latest semver release ${latestRelease.tagName} uses unsupported prerelease label "${prerelease}".`)
  }

  return `${major}.${minor}.${patch}-beta.${Number(betaMatch[1]) + 1}`
}

function normalizeSha (sha) {
  return typeof sha === 'string' ? sha.trim().toLowerCase() : ''
}

function resolveScheduledPrerelease ({ releases, masterSha, resolveTagSha }) {
  const sourceSha = normalizeSha(masterSha)
  if (!sourceSha) throw new Error('A master commit SHA is required.')
  if (typeof resolveTagSha !== 'function') throw new Error('A tag SHA resolver is required.')

  const semverReleases = getSemverReleases(releases).map(release => ({
    ...release,
    commitSha: normalizeSha(resolveTagSha(release.tagName))
  }))

  const releasedMaster = semverReleases.find(release => release.commitSha === sourceSha)
  if (releasedMaster) {
    return {
      shouldRelease: false,
      skipReason: `master ${sourceSha} is already released as ${releasedMaster.tagName}`,
      releasedTag: releasedMaster.tagName,
      sourceSha
    }
  }

  const latestRelease = getLatestRelease(semverReleases)
  const nextVersion = getNextBetaVersion(latestRelease)
  const nextTag = `v${nextVersion}`

  return {
    shouldRelease: true,
    nextVersion,
    nextTag,
    previousTag: latestRelease.tagName,
    sourceSha
  }
}

function buildReleaseNotes ({ version, tag, sourceSha, previousTag, repository, runUrl, sourceBranch = 'master' }) {
  const lines = [
    '## Traceability',
    `- Version: ${version}`,
    `- Source commit: ${sourceSha}`,
    `- Source branch: ${sourceBranch}`
  ]

  if (runUrl) lines.push(`- Workflow run: ${runUrl}`)
  if (previousTag) lines.push(`- Previous release: ${previousTag}`)
  if (repository && previousTag) {
    lines.push(`- Changes: https://github.com/${repository}/compare/${previousTag}...${tag}`)
  }

  return `${lines.join('\n')}\n`
}

function buildTagMessage ({ version, tag, sourceSha, previousTag, repository, runUrl }) {
  return buildReleaseNotes({
    version,
    tag,
    sourceSha,
    previousTag,
    repository,
    runUrl
  }).replace('## Traceability\n', `${tag}\n\n`)
}

function runCommand (command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function readGithubReleases () {
  const output = runCommand('gh', [
    'release',
    'list',
    '--limit',
    '100',
    '--json',
    'tagName,isDraft,isPrerelease,publishedAt'
  ])

  return JSON.parse(output)
}

function resolveGitTagSha (tagName) {
  return runCommand('git', ['rev-list', '-n', '1', tagName])
}

function getRunUrl (options) {
  if (options.runUrl) return options.runUrl

  const serverUrl = process.env.GITHUB_SERVER_URL
  const repository = options.repository || process.env.GITHUB_REPOSITORY
  const runId = process.env.GITHUB_RUN_ID

  if (!serverUrl || !repository || !runId) return ''
  return `${serverUrl}/${repository}/actions/runs/${runId}`
}

function appendGithubOutput (name, value) {
  const outputPath = process.env.GITHUB_OUTPUT
  const text = String(value || '')

  if (!outputPath) {
    console.log(`${name}=${text}`)
    return
  }

  if (!text.includes('\n')) {
    fs.appendFileSync(outputPath, `${name}=${text}\n`)
    return
  }

  const delimiter = `EOF_${name}_${Date.now()}`
  fs.appendFileSync(outputPath, `${name}<<${delimiter}\n${text}\n${delimiter}\n`)
}

function parseArgs (argv) {
  const args = [...argv]
  const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'resolve'
  const options = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg.startsWith('--')) continue

    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    options[key] = args[index + 1]
    index += 1
  }

  return { command, options }
}

function writeResolveOutputs (result, options) {
  appendGithubOutput('should_release', result.shouldRelease ? 'true' : 'false')
  appendGithubOutput('source_sha', result.sourceSha)

  if (!result.shouldRelease) {
    appendGithubOutput('skip_reason', result.skipReason)
    appendGithubOutput('released_tag', result.releasedTag)
    return
  }

  const runUrl = getRunUrl(options)
  const repository = options.repository || process.env.GITHUB_REPOSITORY || ''
  const releaseNotes = buildReleaseNotes({
    version: result.nextVersion,
    tag: result.nextTag,
    sourceSha: result.sourceSha,
    previousTag: result.previousTag,
    repository,
    runUrl
  })

  appendGithubOutput('next_version', result.nextVersion)
  appendGithubOutput('next_tag', result.nextTag)
  appendGithubOutput('previous_tag', result.previousTag)
  appendGithubOutput('release_notes', releaseNotes)
  appendGithubOutput('tag_message', buildTagMessage({
    version: result.nextVersion,
    tag: result.nextTag,
    sourceSha: result.sourceSha,
    previousTag: result.previousTag,
    repository,
    runUrl
  }))
}

function main () {
  const { command, options } = parseArgs(process.argv.slice(2))

  if (command === 'resolve') {
    const result = resolveScheduledPrerelease({
      releases: readGithubReleases(),
      masterSha: options.masterSha,
      resolveTagSha: resolveGitTagSha
    })
    writeResolveOutputs(result, options)
    return
  }

  if (command === 'previous-release-tag') {
    const previousTag = getPreviousReleaseTag(readGithubReleases(), options.currentTag)
    appendGithubOutput('previous_tag', previousTag)
    process.stdout.write(`${previousTag}\n`)
    return
  }

  if (command === 'release-notes') {
    process.stdout.write(buildReleaseNotes({
      version: options.version,
      tag: options.tag,
      sourceSha: options.sourceSha,
      previousTag: options.previousTag,
      repository: options.repository || process.env.GITHUB_REPOSITORY || '',
      runUrl: getRunUrl(options)
    }))
    return
  }

  throw new Error(`Unsupported command: ${command}`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  buildReleaseNotes,
  buildTagMessage,
  compareParsedVersions,
  getLatestRelease,
  getNextBetaVersion,
  getPreviousReleaseTag,
  getSemverReleases,
  parseSemverTag,
  resolveScheduledPrerelease
}
