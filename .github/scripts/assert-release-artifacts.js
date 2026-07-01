const fs = require('fs')
const path = require('path')

const [platform, ...extensions] = process.argv.slice(2)

if (!platform || extensions.length === 0) {
  console.error('Usage: node .github/scripts/assert-release-artifacts.js <platform> <extension...>')
  process.exit(1)
}

const distDir = path.join(process.cwd(), 'dist')
const expectedExtensions = new Set(extensions.map(extension => (
  extension.startsWith('.') ? extension : `.${extension}`
)))

function walk (directory) {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}

function relativeToWorkspace (file) {
  return path.relative(process.cwd(), file)
}

const files = walk(distDir).map(relativeToWorkspace)

if (files.length === 0) {
  console.log('No files found in dist.')
} else {
  console.log(`Files in dist for ${platform}:`)
  files.forEach(file => console.log(file))
}

const topLevelArtifacts = fs.existsSync(distDir)
  ? fs.readdirSync(distDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join('dist', entry.name))
    .filter(file => expectedExtensions.has(path.extname(file)))
  : []

if (topLevelArtifacts.length === 0) {
  console.error(`No top-level ${platform} package artifacts were produced in dist.`)
  console.error(`Expected one of: ${Array.from(expectedExtensions).join(', ')}`)
  process.exit(1)
}

console.log(`Found ${platform} package artifacts:`)
topLevelArtifacts.forEach(file => console.log(file))
