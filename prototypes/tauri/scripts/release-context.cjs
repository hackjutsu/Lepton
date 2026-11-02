const fs = require('node:fs')

const tagPattern = /^rust-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/

function resolveRelease ({ event, refType, refName, releaseRef, publish, version }) {
  if (!['never', 'draft', 'prerelease'].includes(publish)) throw new Error('Invalid publish mode')
  if (event === 'push') {
    if (refType !== 'tag') throw new Error('Rust release pushes must use a tag')
    releaseRef = refName
    publish = 'prerelease'
  } else if (event !== 'workflow_dispatch') {
    throw new Error('Unsupported release event')
  }

  if (publish === 'never') return { publish, tag: '' }
  const tag = releaseRef.replace(/^refs\/tags\//, '')
  const match = tagPattern.exec(tag)
  if (!match) throw new Error('Publishing requires a rust-v<version> tag as release_ref')
  if (match[1] !== version) throw new Error('Rust release tag must match the Tauri configuration version')
  return { publish, tag }
}

if (require.main === module) {
  try {
    const config = JSON.parse(fs.readFileSync('prototypes/tauri/src-tauri/tauri.conf.json', 'utf8'))
    const resolved = resolveRelease({
      event: process.env.GITHUB_EVENT_NAME,
      refType: process.env.GITHUB_REF_TYPE,
      refName: process.env.GITHUB_REF_NAME,
      releaseRef: process.env.RELEASE_REF || '',
      publish: process.env.PUBLISH_MODE || 'never',
      version: config.version
    })
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${resolved.publish}\ntag=${resolved.tag}\n`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { resolveRelease }
