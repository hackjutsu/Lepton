const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

module.exports = async function verifyGitLabUi ({ baseUrl, token }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-gitlab-e2e-'))
  const configHome = path.join(root, 'config')
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(configHome)
  fs.mkdirSync(userData)
  fs.writeFileSync(path.join(configHome, '.leptonrc'), JSON.stringify({
    autoUpdate: false,
    provider: { type: 'gitlab' },
    gitlab: { host: baseUrl },
    snippet: { downloadAll: true, newSnippetPrivate: true },
    notifications: { success: false, failure: false },
    logger: { level: 'error' }
  }))
  console.log(`Live Electron artifacts: ${root}`)
  try {
    for (const phase of ['main', 'restart']) {
      await new Promise((resolve, reject) => {
        const child = spawn(require('electron'), [
          `--user-data-dir=${userData}`, path.join(__dirname, 'gitlab-ui-main.js')
        ], {
          env: { ...process.env, XDG_CONFIG_HOME: configHome, LEPTON_E2E_TOKEN: token, LEPTON_E2E_URL: baseUrl, LEPTON_E2E_ARTIFACTS: root, LEPTON_E2E_PHASE: phase },
          stdio: ['ignore', 'pipe', 'pipe']
        })
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Live UI test timeout')) }, 600000)
        const print = data => process.stdout.write(data.toString().split(token).join('[REDACTED]'))
        child.stdout.on('data', print)
        child.stderr.on('data', print)
        child.on('error', error => { clearTimeout(timer); reject(error) })
        child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Live UI exit ${code}`)) })
      })
    }
  } finally {
    fs.rmSync(configHome, { recursive: true, force: true })
    fs.rmSync(userData, { recursive: true, force: true })
  }
}
