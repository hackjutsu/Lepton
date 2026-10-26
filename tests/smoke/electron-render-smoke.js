const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const electronPath = require('electron')

if (process.argv.includes('--login-layout')) process.env.LEPTON_SMOKE_LOGIN_LAYOUT = '1'

const repoRoot = path.resolve(__dirname, '../..')
const bundlePath = path.join(repoRoot, 'bundle', 'app.bundle.js')
const smokeMainPath = path.join(__dirname, 'electron-render-smoke-main.js')

function assertBuiltBundleExists () {
  if (!fs.existsSync(bundlePath)) {
    throw new Error('Missing bundle/app.bundle.js. Run `npm run test:build` before the smoke test.')
  }
}

function createTempHome (locale = 'en', configOverrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-smoke-'))
  const configHome = path.join(root, 'config')
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(configHome, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(path.join(configHome, '.leptonrc'), JSON.stringify(Object.assign({
    autoUpdate: false,
    enterprise: {
      token: 'smoke-legacy-enterprise-token'
    },
    i18n: {
      locale
    },
    logger: {
      level: 'error'
    }
  }, configOverrides)))
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
    name: 'new-draft',
    selector: '.new-gist-draft-callout',
    text: 'Local draft available|Created Sep 6, 2026|Load draft|Drop draft|Submitting without loading the local draft will discard it.'
  },
  {
    name: 'about',
    selector: '.about-modal .modal-title',
    text: 'Settings|Preferences|Cancel|Apply|Save',
    forbiddenSelector: '.preferences-section h3'
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
    name: 'multi-filter',
    selector: '.active-layout',
    text: 'JavaScript|#ui|#smoke|React 19 render fixture',
    activeFilters: '#JavaScript|#smoke|#ui',
    filterActions: [
      { label: '#JavaScript' },
      { label: '#backend' },
      { label: '#ui' },
      { label: '#smoke', shiftKey: true }
    ],
    snippetCount: 1,
    snippetTitles: 'React 19 render fixture'
  },
  {
    name: 'multi-filter-empty',
    selector: '.active-layout',
    text: 'JavaScript|#backend|No result found...',
    activeFilters: '#JavaScript|#backend',
    filterActions: [
      { label: '#JavaScript' },
      { label: '#backend' }
    ],
    snippetCount: 0
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
    name: 'login-expired-token',
    selector: '.login-modal',
    text: 'Login|GitHub Login|Token invalid. Please try again.',
    forbiddenText: 'See log',
    forbiddenSelector: '.login-alert'
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
      LEPTON_SMOKE_EXPECTED_ACTIVE_FILTERS: options.activeFilters || '',
      LEPTON_SMOKE_EXPECTED_SNIPPET_COUNT: options.snippetCount === undefined ? '' : String(options.snippetCount),
      LEPTON_SMOKE_EXPECTED_SNIPPET_TITLES: options.snippetTitles || '',
      LEPTON_SMOKE_FILTER_ACTIONS: JSON.stringify(options.filterActions || []),
      LEPTON_SMOKE_FORBIDDEN_SELECTOR: options.forbiddenSelector || '',
      LEPTON_SMOKE_FORBIDDEN_TEXT: options.forbiddenText || '',
      LEPTON_SMOKE_EXPECTED_PROVIDER: options.expectedProvider || '',
      LEPTON_SMOKE_SWITCH_LOGIN_MODE: options.switchLoginMode ? '1' : '',
      LEPTON_SMOKE_SWITCH_PROVIDER: options.switchProvider ? '1' : '',
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
    }, process.env.LEPTON_SMOKE_LOGIN_LAYOUT === '1' ? 120000 : 45000)

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
  if (process.env.LEPTON_SMOKE_LOGIN_LAYOUT === '1') {
    for (const type of ['github', 'gitlab']) {
      await runSmokeProcess(createTempHome('en', { provider: { type } }), {
        expectedProvider: type,
        expectedText: type === 'gitlab' ? 'Login|GitLab Token Login' : 'Login|GitHub Login'
      })
    }
    return
  }
  await runSmokeProcess(createTempHome('en'), {
    expectedText: 'Login|GitHub Login',
    switchProvider: true
  })
  await runSmokeProcess(createTempHome('ja'), {
    expectedText: 'ログイン|GitHubでログイン'
  })
  await runSmokeProcess(createTempHome('en', {
    provider: { type: 'gitlab' },
    gitlab: { host: 'gitlab.example.com' }
  }), {
    expectedProvider: 'gitlab',
    expectedText: 'Login|GitLab Token Login'
  })

  for (const fixture of RENDER_FIXTURES) {
    await runSmokeProcess(createTempHome('en'), {
      expectedSelector: fixture.selector,
      activeFilters: fixture.activeFilters,
      filterActions: fixture.filterActions,
      forbiddenText: fixture.forbiddenText,
      expectedText: fixture.text,
      forbiddenSelector: fixture.forbiddenSelector,
      renderFixture: fixture.name,
      snippetCount: fixture.snippetCount,
      snippetTitles: fixture.snippetTitles,
      switchLoginMode: fixture.switchLoginMode,
      switchText: fixture.switchText
    })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
