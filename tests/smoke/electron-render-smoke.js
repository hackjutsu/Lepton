const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const electronPath = require('electron')

const repoRoot = path.resolve(__dirname, '../..')
const bundlePath = path.join(repoRoot, 'bundle', 'app.bundle.js')
const smokeMainPath = path.join(__dirname, 'electron-render-smoke-main.js')

function assertBuiltBundleExists () {
  if (!fs.existsSync(bundlePath)) {
    throw new Error('Missing bundle/app.bundle.js. Run `npm run test:build` before the smoke test.')
  }
}

function createTempHome () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-smoke-'))
  const configHome = path.join(root, 'config')
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(configHome, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(path.join(configHome, '.leptonrc'), JSON.stringify({
    autoUpdate: false,
    logger: {
      level: 'error'
    }
  }))
  return { configHome, root, userData }
}

function runSmokeProcess (tempHome) {
  return new Promise((resolve, reject) => {
    const child = spawn(electronPath, [
      `--user-data-dir=${tempHome.userData}`,
      smokeMainPath
    ], {
      cwd: repoRoot,
      env: Object.assign({}, process.env, {
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        LEPTON_SMOKE_ARTIFACT_DIR: tempHome.root,
        XDG_CONFIG_HOME: tempHome.configHome
      }),
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let output = ''
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Electron render smoke test timed out.\n${output}`))
    }, 45000)

    child.stdout.on('data', data => {
      const text = data.toString()
      output += text
      process.stdout.write(text)
    })
    child.stderr.on('data', data => {
      const text = data.toString()
      output += text
      process.stderr.write(text)
    })
    child.on('error', err => {
      clearTimeout(timeout)
      reject(err)
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Electron render smoke test failed with exit code ${code} and signal ${signal}.\n${output}`))
    })
  })
}

async function main () {
  assertBuiltBundleExists()
  await runSmokeProcess(createTempHome())
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
