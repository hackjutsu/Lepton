const fs = require('node:fs')
const path = require('node:path')

const targets = {
  'macos-arm64': [['dmg', '.dmg']],
  'macos-x64': [['dmg', '.dmg']],
  'windows-x64': [['nsis', '.exe']],
  'linux-x64': [['deb', '.deb'], ['appimage', '.AppImage']]
}

function stageArtifacts (target, bundleDir, outputDir) {
  const expected = targets[target]
  if (!expected) throw new Error(`Unsupported release target: ${target}`)
  fs.mkdirSync(outputDir, { recursive: true })
  return expected.map(([directory, extension]) => {
    const inputDir = path.join(bundleDir, directory)
    const matches = fs.readdirSync(inputDir).filter(name => name.endsWith(extension))
    if (matches.length !== 1) throw new Error(`Expected one ${extension} bundle for ${target}, found ${matches.length}`)
    const destination = path.join(outputDir, `lepton-rust-${target}-${matches[0]}`)
    fs.copyFileSync(path.join(inputDir, matches[0]), destination, fs.constants.COPYFILE_EXCL)
    return destination
  })
}

if (require.main === module) {
  try {
    const staged = stageArtifacts(process.argv[2], process.argv[3], process.argv[4])
    for (const file of staged) console.log(`Staged ${file}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { stageArtifacts }
