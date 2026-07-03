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

function createTempHome (locale = 'en') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-smoke-'))
  const configHome = path.join(root, 'config')
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(configHome, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(path.join(configHome, '.leptonrc'), JSON.stringify({
    autoUpdate: false,
    i18n: {
      locale
    },
    logger: {
      level: 'error'
    }
  }))
  return { configHome, root, userData }
}

const RENDER_FIXTURES = [
  {
    name: 'active',
    selector: '.active-layout .snippet-box',
    text: 'React 19 render fixture'
  },
  {
    name: 'edit',
    selector: '.modal .gist-editor-form .CodeMirror',
    text: 'Edit'
  },
  {
    name: 'new',
    selector: '.modal .gist-editor-form .CodeMirror',
    text: 'New'
  },
  {
    name: 'about',
    selector: '.about-modal .modal-title',
    text: 'About'
  },
  {
    name: 'dashboard',
    selector: '.dashboard-modal canvas',
    text: 'Dashboard'
  },
  {
    name: 'search',
    selector: '.search-modal .search-box',
    text: ''
  },
  {
    name: 'search-results',
    selector: '.search-modal .search-result-count',
    text: '6 snippets found|React 19 render fixture'
  },
  {
    name: 'delete',
    selector: '.modal-footer .btn-danger',
    text: 'Delete the snippet?'
  },
  {
    name: 'raw',
    selector: '.raw-modal .code-area-raw',
    text: 'hello.js'
  },
  {
    name: 'pinned-tags',
    selector: '.pinned-tags-modal .pin-tag-list',
    text: 'Shortcuts'
  },
  {
    name: 'immersive',
    selector: '.snippet-panel-immersive .snippet-box',
    text: 'React 19 render fixture'
  },
  {
    name: 'php-html',
    selector: '.code-area .language-php',
    text: 'PHP template|index.php|Ready'
  },
  {
    name: 'jupyter-notebook',
    selector: '.jupyterNotebook-section .nb-notebook',
    text: 'Notebook Fixture|hello from notebook|42'
  },
  {
    name: 'login-progress',
    selector: '.login-status-line',
    text: 'Exchanging token...'
  },
  {
    name: 'login-index-sync',
    selector: '.login-status-line',
    text: 'Syncing snippet index...'
  },
  {
    name: 'login-download-progress',
    selector: '.login-status-line',
    text: 'Downloading snippets (12/252)'
  },
  {
    name: 'login-error-log',
    selector: '.login-status-line a[href="file:///tmp/lepton-login.log"]',
    text: 'Sign-in failed.|See log'
  },
  {
    name: 'login-stale-success-logged-out',
    selector: '.login-modal',
    text: 'Login|GitHub Login',
    forbiddenText: 'Signed in.',
    switchLoginMode: true,
    switchText: 'Token Login'
  },
  {
    name: 'exit',
    selector: '.logout-modal .modal-footer .btn-danger',
    text: 'Confirm logout?|logout'
  }
]

function runSmokeProcess (tempHome, options) {
  return new Promise((resolve, reject) => {
    const electronArgs = [
      `--user-data-dir=${tempHome.userData}`,
      smokeMainPath
    ]

    if (process.env.LEPTON_SMOKE_NO_SANDBOX === '1') {
      electronArgs.unshift('--no-sandbox')
    }

    const env = Object.assign({}, process.env, {
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      LEPTON_SMOKE_ARTIFACT_DIR: tempHome.root,
      LEPTON_SMOKE_AFTER_SWITCH_TEXT: options.switchText || '',
      LEPTON_SMOKE_FORBIDDEN_TEXT: options.forbiddenText || '',
      LEPTON_SMOKE_SWITCH_LOGIN_MODE: options.switchLoginMode ? '1' : '',
      LEPTON_SMOKE_EXPECTED_TEXT: options.expectedText,
      XDG_CONFIG_HOME: tempHome.configHome
    })

    if (options.renderFixture) {
      env.LEPTON_RENDER_FIXTURE = options.renderFixture
      env.LEPTON_SMOKE_EXPECTED_SELECTOR = options.expectedSelector
    }

    const child = spawn(electronPath, electronArgs, {
      cwd: repoRoot,
      env,
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
  await runSmokeProcess(createTempHome('en'), {
    expectedText: 'Login|GitHub Login'
  })
  await runSmokeProcess(createTempHome('ja'), {
    expectedText: 'ログイン|GitHubでログイン'
  })

  for (const fixture of RENDER_FIXTURES) {
    await runSmokeProcess(createTempHome('en'), {
      expectedSelector: fixture.selector,
      forbiddenText: fixture.forbiddenText,
      expectedText: fixture.text,
      renderFixture: fixture.name,
      switchLoginMode: fixture.switchLoginMode,
      switchText: fixture.switchText
    })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
